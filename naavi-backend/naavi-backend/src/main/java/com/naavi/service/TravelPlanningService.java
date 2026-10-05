package com.naavi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.ai.ItineraryGenerator;
import com.naavi.ai.ItineraryGenerator.GeneratedPlan;
import com.naavi.ai.TripQaService;
import com.naavi.ai.TripRequestExtractor;
import com.naavi.ai.TripRequestExtractor.Extraction;
import com.naavi.dto.Dto.ChatResponse;
import com.naavi.entity.*;
import com.naavi.exception.ConflictException;
import com.naavi.model.MessageRole;
import com.naavi.model.TripStatus;
import com.naavi.service.PreferenceResolver.EffectivePreferences;
import com.naavi.service.WeatherService.WeatherResult;
import com.naavi.tools.ToolExecutor;
import com.naavi.util.Money;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import com.naavi.ai.PlaceRecommendationService;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Orchestrates one chat turn:
 *
 *   authenticate (controller) -> load trip + saved preferences -> extract requirements from the message
 *   -> ask for anything essential that is missing -> fetch weather / travel data -> build AI context
 *   -> generate + validate + cost the itinerary -> save -> reply
 *
 * Deliberately NOT @Transactional: LLM calls can take a minute and must not hold a DB connection.
 * Each repository call below runs in its own short transaction.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TravelPlanningService {
    private static final int DEFAULT_DAYS = 3;
    private static final int HISTORY_FOR_PROMPT = 6;

    private final TripService tripService;
    private final ChatService chatService;
    private final PreferenceService preferenceService;
    private final PreferenceResolver resolver;
    private final TripRequestExtractor extractor;
    private final WeatherService weatherService;
    private final TravelDataProvider travelDataProvider;
    private final ItineraryGenerator generator;
    private final ItineraryService itineraryService;
    private final TripQaService qaService;
    private final PlaceRecommendationService recommender;

    /** Trips currently being processed; prevents two concurrent generations for the same trip. */
    private final Set<Long> inFlight = ConcurrentHashMap.newKeySet();

    public ChatResponse handle(Long userId, Long tripId, String message) {
        boolean created = tripId == null;
        Trip trip = created ? tripService.createDraft(userId) : tripService.getOwned(userId, tripId);
        if (!inFlight.add(trip.getId())) {
            throw new ConflictException("This trip is still being processed. Please wait for the current reply.");
        }
        try {
            return process(userId, trip, message.trim());
        } catch (RuntimeException e) {
            if (created) {
                try {
                    tripService.delete(userId, trip.getId()); // don't leave an empty draft behind
                } catch (RuntimeException ignored) {
                    log.warn("Could not clean up draft trip {}", trip.getId());
                }
            }
            throw e;
        } finally {
            inFlight.remove(trip.getId());
        }
    }

    private ChatResponse process(Long userId, Trip trip, String message) {
        ChatConversation conv = chatService.getOrCreate(trip.getId());
        List<ChatMessage> history = chatService.recent(conv.getId(), HISTORY_FOR_PROMPT);
        chatService.add(conv.getId(), MessageRole.USER, message);

        TripPreferenceOverride override = tripService.getOverride(trip.getId()).orElse(null);
        Itinerary latest = itineraryService.latest(trip.getId()).orElse(null);

        // 1. understand the message
        Extraction ex = extractor.extract(trip, override, latest != null, history, message);

        if (ex.intent().equals("SMALLTALK")) {
            String reply = ex.reply() != null ? ex.reply()
                    : "Hi! I'm Naavi. Tell me where you'd like to go, where you're starting from, how many people are "
                    + "travelling and your budget, and I'll plan the trip.";
            return respond(trip, conv, "MESSAGE", reply, null, List.of());
        }
        if (ex.intent().equals("RECOMMEND")) {
            override = applyExtraction(trip, override, ex); // remembers source, budget, travellers if mentioned
            UserPreference savedPrefs = preferenceService.find(userId).orElse(null);
            EffectivePreferences recPrefs = resolver.resolve(savedPrefs, override);
            PlaceRecommendationService.Result rec = recommender.recommend(trip, recPrefs, message, ex.placeQuery());
            return respondWith(trip, conv, "RECOMMENDATION", rec.reply(), null, List.of(), rec.json());
        }
        if (ex.intent().equals("QUESTION") && latest != null) {
            String answer = qaService.answer(latest, history, message);
            return respond(trip, conv, "MESSAGE", answer, null, List.of());
        }

        // 2. merge what we learned into the trip (trip-specific preferences go into the override row)
        boolean modify = ex.intent().equals("MODIFY") && latest != null;
        override = applyExtraction(trip, override, ex);

        // 3. ask only for what is essential
        List<String> missing = missingFields(trip);
        if (!missing.isEmpty()) {
            return respond(trip, conv, "QUESTION", askFor(missing), null, missing);
        }
        List<String> assumptions = new ArrayList<>();
        if (trip.getDays() == null) {
            trip.setDays(DEFAULT_DAYS);
            tripService.normalizeSchedule(trip, false);
            tripService.save(trip);
            assumptions.add("You didn't say how long the trip is, so I planned for " + DEFAULT_DAYS + " days.");
        }

        // 4. gather data + build the AI context
        UserPreference saved = preferenceService.find(userId).orElse(null);
        EffectivePreferences prefs = resolver.resolve(saved, override);
        // weather runs alongside the transport / stay tools; every tool degrades to "not available" instead of failing the plan
        CompletableFuture<WeatherResult> weatherFuture = CompletableFuture.supplyAsync(
                () -> weatherService.get(trip.getDestination(), trip.getStartDate(), trip.getEndDate()), ToolExecutor.EXEC);
        Map<String, Object> external = travelDataProvider.fetch(trip, prefs);
        WeatherResult weather = weatherFuture.join();
        String instructions = modify
                ? (ex.modificationInstructions() != null ? ex.modificationInstructions() : message) : null;
        Map<String, Object> context = buildContext(userId, trip, override, prefs, weather, external,
                latest, instructions);

        // 5. generate, validate, cost, save
        int version = itineraryService.nextVersion(trip.getId());
        GeneratedPlan plan = generator.generate(context, trip, weather, prefs, assumptions, version);
        itineraryService.save(trip, plan);
        trip.setStatus(TripStatus.PLANNED);
        tripService.save(trip);

        return respond(trip, conv, "ITINERARY", summaryReply(trip, plan.json(), assumptions, modify), plan.json(), List.of());
    }

    // ------------------------------------------------------------------ helpers

    private TripPreferenceOverride applyExtraction(Trip t, TripPreferenceOverride ov, Extraction ex) {
        boolean datesChanged = ex.startDate() != null || ex.endDate() != null;
        if (ex.source() != null) t.setSource(ex.source());
        if (ex.destination() != null) t.setDestination(ex.destination());
        if (ex.budget() != null) t.setBudget(ex.budget());
        if (ex.travelers() != null) t.setTravelers(ex.travelers());
        if (ex.days() != null) t.setDays(ex.days());
        if (ex.startDate() != null) t.setStartDate(ex.startDate());
        if (ex.endDate() != null) t.setEndDate(ex.endDate());
        if (ex.specialRequirements() != null) t.setSpecialRequirements(appendRequirement(t.getSpecialRequirements(), ex.specialRequirements()));
        tripService.normalizeSchedule(t, datesChanged);
        tripService.refreshTitle(t);
        tripService.save(t);
        return ex.overrides() != null ? tripService.mergeOverride(t.getId(), ex.overrides()) : ov;
    }

    private static String appendRequirement(String existing, String added) {
        if (existing == null || existing.isBlank()) return added;
        if (existing.toLowerCase().contains(added.toLowerCase())) return existing;
        String merged = existing + "; " + added;
        return merged.length() > 2000 ? merged.substring(0, 2000) : merged;
    }

    private static List<String> missingFields(Trip t) {
        List<String> m = new ArrayList<>();
        if (t.getSource() == null || t.getSource().isBlank()) m.add("source");
        if (t.getDestination() == null || t.getDestination().isBlank()) m.add("destination");
        if (t.getBudget() == null) m.add("budget");
        if (t.getTravelers() == null) m.add("travelers");
        return m;
    }

    private static String askFor(List<String> missing) {
        List<String> parts = new ArrayList<>();
        for (String f : missing) {
            parts.add(switch (f) {
                case "source" -> "where you'll be travelling from";
                case "destination" -> "where you'd like to go";
                case "budget" -> "your total budget (in ₹)";
                default -> "how many people are travelling";
            });
        }
        String joined = parts.size() == 1 ? parts.get(0)
                : String.join(", ", parts.subList(0, parts.size() - 1)) + " and " + parts.get(parts.size() - 1);
        return "Happy to plan this! I just need to know " + joined + ".";
    }

    private Map<String, Object> buildContext(Long userId, Trip trip, TripPreferenceOverride ov,
                                             EffectivePreferences prefs, WeatherResult weather,
                                             Map<String, Object> external, Itinerary latest, String instructions) {
        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("today", LocalDate.now().toString());
        ctx.put("user", Map.of("id", userId));

        Map<String, Object> req = new LinkedHashMap<>();
        req.put("source", trip.getSource());
        req.put("destination", trip.getDestination());
        req.put("budget", trip.getBudget());
        req.put("currency", "INR");
        req.put("travelers", trip.getTravelers());
        req.put("days", trip.getDays());
        req.put("startDate", trip.getStartDate() == null ? null : trip.getStartDate().toString());
        req.put("endDate", trip.getEndDate() == null ? null : trip.getEndDate().toString());
        req.put("specialRequirements", trip.getSpecialRequirements());
        ctx.put("tripRequest", req);

        ctx.put("preferences", prefs.values());
        ctx.put("preferenceSources", prefs.sources());
        ctx.put("additionalPreferenceNotes", prefs.notes());

        Map<String, Object> overrides = new LinkedHashMap<>();
        if (ov != null) {
            if (ov.getFoodPreference() != null) overrides.put("foodPreference", ov.getFoodPreference().name());
            if (ov.getLocalTravelPreference() != null) overrides.put("localTravelPreference", ov.getLocalTravelPreference().name());
            if (ov.getAccommodationPreference() != null) overrides.put("accommodationPreference", ov.getAccommodationPreference().name());
            if (ov.getTravelStyle() != null) overrides.put("travelStyle", ov.getTravelStyle().name());
            if (ov.getTransportationPreference() != null) overrides.put("transportationPreference", ov.getTransportationPreference().name());
            if (ov.getNotes() != null) overrides.put("notes", ov.getNotes());
        }
        ctx.put("tripOverrides", overrides);

        ctx.put("weather", weather);
        ctx.put("travelData", external.get("travelData"));
        ctx.put("hotelData", external.get("hotelData"));
        ctx.put("placeData", external.get("placeData"));
        ctx.put("budgetGuide", external.get("budgetGuide"));

        if (latest != null && instructions != null) {
            ctx.put("previousItinerary", itineraryService.compact(itineraryService.readPlan(latest)));
            ctx.put("modificationInstructions", instructions);
        }
        return ctx;
    }

    /** Deterministic summary text: every number comes from the backend's calculations, not from the LLM. */
    private String summaryReply(Trip trip, ObjectNode plan, List<String> assumptions, boolean modified) {
        JsonNode ex = plan.path("expenses");
        BigDecimal total = ex.path("total").decimalValue();
        BigDecimal budget = ex.path("budget").decimalValue();
        BigDecimal remaining = ex.path("remaining").decimalValue();

        StringBuilder sb = new StringBuilder();
        sb.append(modified ? "I've updated your plan: " : "Here's your plan: ")
                .append(trip.getDays()).append("-day trip to ").append(trip.getDestination())
                .append(" from ").append(trip.getSource())
                .append(" for ").append(trip.getTravelers()).append(trip.getTravelers() == 1 ? " traveller. " : " travellers. ");
        sb.append("Estimated cost is ").append(Money.inr(total)).append(" against your ").append(Money.inr(budget)).append(" budget");
        if (ex.path("withinBudget").asBoolean()) {
            sb.append(" (").append(Money.inr(remaining)).append(" to spare). ");
        } else {
            sb.append(". ").append(ex.path("budgetWarning").asText(""));
            JsonNode red = ex.path("possibleReductions");
            if (red.isArray() && !red.isEmpty()) {
                List<String> items = new ArrayList<>();
                red.forEach(n -> items.add(n.asText()));
                sb.append(" You could: ").append(String.join("; ", items)).append(". ");
            } else {
                sb.append(' ');
            }
        }
        JsonNode alts = plan.path("alternatives");
        if (alts.isArray() && !alts.isEmpty()) {
            List<String> parts = new ArrayList<>();
            for (JsonNode a : alts) {
                parts.add(a.path("planType").asText("") + " (about " + Money.inr(a.path("expenses").path("total").decimalValue()) + ")");
            }
            sb.append("I've also prepared alternatives: ").append(String.join(" and ", parts)).append(". ");
        }
        JsonNode w = plan.path("weather");
        switch (w.path("mode").asText("")) {
            case "TRIP_DATES" -> sb.append("The forecast for your travel dates is included. ");
            case "UPCOMING" -> sb.append(w.path("note").asText("")).append(' ');
            default -> sb.append("I couldn't fetch the weather forecast right now. ");
        }
        sb.append("Prices are estimates unless marked live.");
        appendTrains(sb, plan.path("transportation"));
        appendHotels(sb, plan.path("accommodation"));
        for (String a : assumptions) sb.append("\n\n").append(a);
        return sb.toString().trim();
    }

    private void appendTrains(StringBuilder sb, JsonNode transport) {
        StringBuilder t = new StringBuilder();
        if (transport.isArray()) {
            for (JsonNode n : transport) {
                if (n.path("trainName").asText("").isBlank()) continue;
                t.append("\n- ").append(n.path("direction").asText("")).append(": ").append(n.path("trainName").asText());
                if (!n.path("trainNumber").asText("").isBlank()) t.append(" (").append(n.path("trainNumber").asText()).append(")");
                t.append(", ").append(n.path("from").asText("")).append(" to ").append(n.path("to").asText(""));
                if (!n.path("travelClass").asText("").isBlank()) t.append(", ").append(n.path("travelClass").asText());
                t.append(", est. fare ").append(Money.inr(n.path("costPerPerson").decimalValue())).append(" per person");
                if (n.hasNonNull("bookingUrl")) t.append(" - book: ").append(n.path("bookingUrl").asText());
            }
        }
        if (t.length() > 0) sb.append("\n\nTrains (estimated fares, confirm on IRCTC):").append(t);
    }

    private void appendHotels(StringBuilder sb, JsonNode stays) {
        StringBuilder h = new StringBuilder();
        if (stays.isArray()) {
            for (JsonNode n : stays) {
                if (n.path("name").asText("").isBlank()) continue;
                h.append("\n- ").append(n.path("name").asText());
                if (!n.path("area").asText("").isBlank()) h.append(", ").append(n.path("area").asText());
                h.append(" - est. ").append(Money.inr(n.path("pricePerNight").decimalValue())).append("/night");
                if (n.hasNonNull("bookingUrl")) h.append(" - book: ").append(n.path("bookingUrl").asText());
            }
        }
        if (h.length() > 0) sb.append("\n\nHotels (estimated rates, confirm on the booking page):").append(h);
    }

    private ChatResponse respond(Trip trip, ChatConversation conv, String type, String reply, JsonNode itinerary,
                                 List<String> missing) {
        return respondWith(trip, conv, type, reply, itinerary, missing, null);
    }

    private ChatResponse respondWith(Trip trip, ChatConversation conv, String type, String reply, JsonNode itinerary,
                                     List<String> missing, JsonNode recommendations) {
        chatService.add(conv.getId(), MessageRole.ASSISTANT, reply);
        TripPreferenceOverride ov = tripService.getOverride(trip.getId()).orElse(null);
        return new ChatResponse(type, reply, Mapper.trip(trip, ov), itinerary, missing, recommendations);
    }
}
