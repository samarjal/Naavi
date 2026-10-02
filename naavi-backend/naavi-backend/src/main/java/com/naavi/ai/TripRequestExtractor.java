package com.naavi.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.dto.Dto.OverridesDto;
import com.naavi.entity.ChatMessage;
import com.naavi.entity.Trip;
import com.naavi.entity.TripPreferenceOverride;
import com.naavi.model.*;
import com.naavi.util.Enums;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Step 1 of the pipeline: turn a chat message into structured trip fields + an intent. */
@Component
@RequiredArgsConstructor
public class TripRequestExtractor {
    private final GroqClient groq;
    private final ObjectMapper mapper;

    private static final Set<String> INTENTS = Set.of("PLAN", "MODIFY", "QUESTION", "SMALLTALK");

    public record Extraction(String intent, String source, String destination, BigDecimal budget, Integer travelers,
                             Integer days, LocalDate startDate, LocalDate endDate, OverridesDto overrides,
                             String specialRequirements, String modificationInstructions, String reply) {}

    public Extraction extract(Trip trip, TripPreferenceOverride currentOverride, boolean hasItinerary,
                              List<ChatMessage> history, String message) {
        ObjectNode input = mapper.createObjectNode();
        ObjectNode t = input.putObject("currentTrip");
        t.put("source", trip.getSource());
        t.put("destination", trip.getDestination());
        if (trip.getBudget() != null) t.put("budget", trip.getBudget());
        if (trip.getTravelers() != null) t.put("travelers", trip.getTravelers());
        if (trip.getDays() != null) t.put("days", trip.getDays());
        if (trip.getStartDate() != null) t.put("startDate", trip.getStartDate().toString());
        if (trip.getEndDate() != null) t.put("endDate", trip.getEndDate().toString());
        t.put("specialRequirements", trip.getSpecialRequirements());
        input.put("hasExistingItinerary", hasItinerary);
        var hist = input.putArray("recentMessages");
        for (ChatMessage m : history) {
            ObjectNode h = hist.addObject();
            h.put("role", m.getRole().name());
            String c = m.getContent();
            h.put("content", c.length() > 500 ? c.substring(0, 500) + "…" : c);
        }
        input.put("latestUserMessage", message);

        JsonNode out = groq.chatJson(List.of(
                GroqClient.Msg.system(systemPrompt()),
                GroqClient.Msg.user(input.toString())), 700);
        return parse(out);
    }

    private String systemPrompt() {
        return """
            You are the request-understanding module of Naavi, an AI travel planner for Indian travellers.
            Read the latest user message (with the recent conversation and current trip state) and return ONLY a JSON object:

            {
              "intent": "PLAN | MODIFY | QUESTION | SMALLTALK",
              "source": string|null,
              "destination": string|null,
              "budget": number|null,
              "travelers": integer|null,
              "days": integer|null,
              "startDate": "YYYY-MM-DD"|null,
              "endDate": "YYYY-MM-DD"|null,
              "tripOverrides": {
                "foodPreference": string|null,
                "localTravelPreference": string|null,
                "accommodationPreference": string|null,
                "travelStyle": string|null,
                "transportationPreference": string|null,
                "notes": string|null
              },
              "specialRequirements": string|null,
              "modificationInstructions": string|null,
              "reply": string|null
            }

            Rules:
            - Only fill a field with something the user said or clearly implied in THIS message. Everything else is null.
              The current trip state is supplied separately; do not repeat it unless the user changes it.
            - intent PLAN: the user gives or changes core trip requirements (source, destination, budget, travellers, days, dates).
              MODIFY: the user asks to change an existing itinerary (cheaper hotel, remove trekking, add more food experiences,
              make it suitable for parents...). If the change affects a core field, also set that field
              ("add another day" -> days = current days + 1; "reduce the budget to 20000" -> budget = 20000).
              Put the user's request in "modificationInstructions" in plain words.
              QUESTION: the user asks something about the trip without requesting a change.
              SMALLTALK: greeting or unrelated chatter; put a short friendly reply in "reply" that invites them to share
              destination, starting city, number of travellers and budget.
            - budget is the TOTAL trip budget in INR as a plain number ("25k" = 25000, "1.5 lakh" = 150000).
            - Dates: today's date is %s. Resolve relative or year-less dates to the next future occurrence. "10-14 Oct" gives
              startDate and endDate. Do not invent dates.
            - tripOverrides: only when the user states a preference for THIS trip ("for this trip I want cabs", "use cabs instead
              of buses", "luxury hotel this time"). Allowed values:
                foodPreference: %s
                localTravelPreference: %s
                accommodationPreference: %s
                travelStyle: %s
                transportationPreference: %s
              "notes" holds any other trip-specific constraint (e.g. "traveling with a toddler").
            - specialRequirements: requirements about who/what the trip must suit ("family-friendly", "suitable for parents",
              "wheelchair accessible"). Null otherwise.
            - Output valid JSON only, no commentary.
            """.formatted(LocalDate.now(),
                Enums.options(FoodPreference.class), Enums.options(LocalTravelPreference.class),
                Enums.options(AccommodationPreference.class), Enums.options(TravelStyle.class),
                Enums.options(TransportationPreference.class));
    }

    private Extraction parse(JsonNode n) {
        String intent = str(n, "intent");
        intent = intent == null ? "PLAN" : intent.toUpperCase();
        if (!INTENTS.contains(intent)) intent = "PLAN";

        JsonNode o = n.path("tripOverrides");
        OverridesDto ov = new OverridesDto(
                Enums.parse(FoodPreference.class, str(o, "foodPreference")),
                Enums.parse(LocalTravelPreference.class, str(o, "localTravelPreference")),
                Enums.parse(AccommodationPreference.class, str(o, "accommodationPreference")),
                Enums.parse(TravelStyle.class, str(o, "travelStyle")),
                Enums.parse(TransportationPreference.class, str(o, "transportationPreference")),
                cap(str(o, "notes"), 1000));

        return new Extraction(intent, cap(str(n, "source"), 120), cap(str(n, "destination"), 120),
                positiveMoney(n, "budget"), boundedInt(n, "travelers", 1, 50), boundedInt(n, "days", 1, 30),
                date(n, "startDate"), date(n, "endDate"), ov.isEmpty() ? null : ov,
                cap(str(n, "specialRequirements"), 500), cap(str(n, "modificationInstructions"), 1000),
                cap(str(n, "reply"), 1000));
    }

    // ---- lenient field readers: the LLM output is untrusted input ----
    private static String str(JsonNode n, String f) {
        JsonNode v = n.get(f);
        if (v == null || v.isNull() || v.isContainerNode()) return null;
        String s = v.asText().trim();
        return s.isEmpty() || s.equalsIgnoreCase("null") ? null : s;
    }

    private static String cap(String s, int max) {
        return s == null ? null : (s.length() > max ? s.substring(0, max) : s);
    }

    private static BigDecimal positiveMoney(JsonNode n, String f) {
        String s = str(n, f);
        if (s == null) return null;
        try {
            BigDecimal v = new BigDecimal(s.replaceAll("[^0-9.]", ""));
            return v.signum() > 0 && v.compareTo(new BigDecimal("100000000")) <= 0 ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer boundedInt(JsonNode n, String f, int min, int max) {
        String s = str(n, f);
        if (s == null) return null;
        try {
            int v = (int) Math.round(Double.parseDouble(s));
            return v >= min && v <= max ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate date(JsonNode n, String f) {
        String s = str(n, f);
        if (s == null) return null;
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
