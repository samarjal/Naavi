package com.naavi.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.config.AppProperties;
import com.naavi.entity.Trip;
import com.naavi.exception.AiServiceException;
import com.naavi.model.DataType;
import com.naavi.model.PlanType;
import com.naavi.service.BudgetEngine;
import com.naavi.service.BudgetEngine.ExpenseLine;
import com.naavi.service.ItineraryValidator;
import com.naavi.service.PreferenceResolver.EffectivePreferences;
import com.naavi.service.WeatherService.WeatherDay;
import com.naavi.service.WeatherService.WeatherResult;
import com.naavi.service.BookingLinkService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Step 3 of the pipeline: LLM drafts the plan, the backend validates it, does all the maths,
 * and assembles the final structured result.
 *
 *   1. primary plan (1.0x budget) - validated, regenerated once if invalid or over budget
 *   2. comfort (~1.2x) + premium (~1.5x) alternatives - separate, lighter call
 *   3. backend recomputes every amount, adds weather per day, marks data provenance
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ItineraryGenerator {
    private static final int MAX_ATTEMPTS = 2;
    private static final BigDecimal TARGET_BUDGET_SHARE = new BigDecimal("0.90");

    private final GroqClient groq;
    private final ObjectMapper mapper;
    private final BudgetEngine budgetEngine;
    private final ItineraryValidator validator;
    private final AppProperties props;
    private final BookingLinkService bookingLinks;

    public record GeneratedPlan(ObjectNode json, Map<PlanType, List<ExpenseLine>> expenseLines, BigDecimal primaryTotal) {}

    private record Attempt(JsonNode raw, List<ExpenseLine> lines, BudgetEngine.Summary summary,
                           ItineraryValidator.Result validation) {}

    public GeneratedPlan generate(Map<String, Object> context, Trip trip, WeatherResult weather,
                                  EffectivePreferences prefs, List<String> assumptions, int version) {
        String ctx = toJson(context);
        BigDecimal budget = trip.getBudget();

        // ---------- 1. primary plan ----------
        Attempt best = null;
        String feedback = null;
        AiServiceException lastAiError = null;
        for (int i = 1; i <= MAX_ATTEMPTS; i++) {
            Attempt a;
            try {
                a = attempt(ctx, feedback, trip, budget);
            } catch (AiServiceException e) {
                lastAiError = e;
                log.warn("Primary plan attempt {} failed: {}", i, e.getMessage());
                feedback = "Your previous reply could not be used. Return ONLY one valid JSON object that follows the schema.";
                continue;
            }
            if (!a.validation().valid()) {
                log.info("Primary plan attempt {} invalid: {}", i, a.validation().errors());
                feedback = "Your previous reply had problems: " + String.join(" ", a.validation().errors())
                        + " Return the complete corrected JSON.";
                continue;
            }
            if (best == null || a.summary().total().compareTo(best.summary().total()) <= 0) best = a;
            if (a.summary().withinBudget()) break;
            BigDecimal target = budget.multiply(TARGET_BUDGET_SHARE).setScale(0, RoundingMode.HALF_UP);
            feedback = "The plan's computed total is " + a.summary().total().toPlainString() + " INR but the user's budget is "
                    + budget.toPlainString() + " INR. Return the complete JSON again with a total of at most "
                    + target.toPlainString() + " INR by choosing cheaper transport, stays, food or activities, "
                    + "while still honouring the user's preferences.";
        }
        if (best == null) {
            throw lastAiError != null ? lastAiError
                    : new AiServiceException("I couldn't build a valid itinerary this time. Please try again or rephrase your request.");
        }

        // ---------- 2. alternatives ----------
        List<String> warnings = new ArrayList<>(best.validation().warnings());
        Map<PlanType, List<ExpenseLine>> allLines = new EnumMap<>(PlanType.class);
        allLines.put(PlanType.BUDGET, best.lines());
        ArrayNode alternatives = buildAlternatives(ctx, best, budget, allLines, warnings);

        // ---------- 3. assemble ----------
        ObjectNode root = mapper.createObjectNode();
        root.put("version", version);
        root.put("generatedAt", Instant.now().toString());
        root.put("planType", PlanType.BUDGET.name());

        ObjectNode summary = best.raw().path("tripSummary").isObject()
                ? best.raw().path("tripSummary").deepCopy() : mapper.createObjectNode();
        if (!summary.hasNonNull("title")) summary.put("title", trip.getTitle());
        summary.put("source", trip.getSource());
        summary.put("destination", trip.getDestination());
        summary.put("travelers", trip.getTravelers());
        summary.put("days", trip.getDays());
        if (trip.getStartDate() != null) summary.put("startDate", trip.getStartDate().toString());
        if (trip.getEndDate() != null) summary.put("endDate", trip.getEndDate().toString());
        summary.put("budget", budget);
        root.set("tripSummary", summary);

        root.set("weather", mapper.valueToTree(weather));

        ArrayNode transport = best.raw().path("transportation").deepCopy();
        ArrayNode stays = best.raw().path("accommodation").isArray()
                ? best.raw().path("accommodation").deepCopy() : mapper.createArrayNode();
        normalizeDataTypes(transport);
        normalizeDataTypes(stays);
        root.set("transportation", transport);
        root.set("accommodation", stays);

        ArrayNode days = best.raw().path("days").deepCopy();
        for (int i = 0; i < days.size(); i++) {
            if (!days.get(i).isObject()) continue;
            ObjectNode day = (ObjectNode) days.get(i);
            day.put("dayNumber", i + 1);
            if (trip.getStartDate() != null) {
                var date = trip.getStartDate().plusDays(i);
                day.put("date", date.toString());
                if ("TRIP_DATES".equals(weather.mode())) {
                    for (WeatherDay wd : weather.days()) {
                        if (wd.date().equals(date)) day.set("weather", mapper.valueToTree(wd));
                    }
                }
            }
        }
        root.set("days", days);

        ObjectNode expenses = budgetEngine.toJson(best.summary());
        expenses.put("planType", PlanType.BUDGET.name());
        expenses.put("targetMultiplier", PlanType.BUDGET.multiplier());
        if (!best.summary().withinBudget()) {
            expenses.put("budgetWarning", budgetEngine.overBudgetMessage(best.summary()));
            ArrayNode red = mapper.createArrayNode();
            JsonNode fromAi = best.raw().path("reductionSuggestions");
            if (fromAi.isArray() && !fromAi.isEmpty()) {
                fromAi.forEach(n -> red.add(n.asText()));
            } else {
                red.add("Choose a budget hotel").add("Use public transport").add("Remove one paid activity");
            }
            expenses.set("possibleReductions", red);
        }
        root.set("expenses", expenses);

        root.set("alternatives", alternatives);
        root.set("packingChecklist", best.raw().path("packingChecklist").isArray()
                ? best.raw().path("packingChecklist").deepCopy() : mapper.createArrayNode());
        root.set("preferencesUsed", mapper.valueToTree(prefs));
        root.put("dataNotice", "Prices, timings and ratings are ESTIMATED unless a line is marked LIVE or USER_PROVIDED. "
                + "Weather comes from a live forecast provider (Open-Meteo).");
        ArrayNode assume = root.putArray("assumptions");
        assumptions.forEach(assume::add);
        ArrayNode warn = root.putArray("validationWarnings");
        warnings.forEach(warn::add);

        bookingLinks.enrich(root, trip);

        return new GeneratedPlan(root, allLines, best.summary().total());
    }

    // ------------------------------------------------------------------ attempt / alternatives

    private Attempt attempt(String ctx, String feedback, Trip trip, BigDecimal budget) {
        String user = "TRIP CONTEXT (JSON):\n" + ctx + "\n\nReturn the itinerary JSON now."
                + (feedback == null ? "" : "\n\nIMPORTANT CORRECTION: " + feedback);
        JsonNode raw = groq.chatJson(List.of(GroqClient.Msg.system(PRIMARY_SYSTEM), GroqClient.Msg.user(user)),
                props.groq().maxTokens());
        ItineraryValidator.Result v = validator.validatePrimary(raw, trip);
        List<String> issues = new ArrayList<>();
        List<ExpenseLine> lines = budgetEngine.parseLines(raw.path("expenseItems"), issues);
        v.warnings().addAll(issues);
        if (lines.isEmpty() && v.valid()) v.errors().add("None of the expenseItems were usable.");
        return new Attempt(raw, lines, budgetEngine.summarise(lines, budget), v);
    }

    private ArrayNode buildAlternatives(String ctx, Attempt primary, BigDecimal budget,
                                        Map<PlanType, List<ExpenseLine>> allLines, List<String> warnings) {
        ArrayNode out = mapper.createArrayNode();
        try {
            BigDecimal comfortTarget = target(budget, PlanType.COMFORT);
            BigDecimal premiumTarget = target(budget, PlanType.PREMIUM);

            ObjectNode base = mapper.createObjectNode();
            base.set("transportation", primary.raw().path("transportation"));
            base.set("accommodation", primary.raw().path("accommodation"));
            base.put("computedTotal", primary.summary().total());
            ObjectNode by = base.putObject("computedByCategory");
            primary.summary().byCategory().forEach((k, v) -> by.put(k.name(), v));

            String user = "TRIP CONTEXT (JSON):\n" + ctx + "\n\nPRIMARY PLAN ALREADY BUILT (JSON):\n" + base
                    + "\n\nUser budget: " + budget.toPlainString() + " INR."
                    + "\nCOMFORT target total: about " + comfortTarget.toPlainString() + " INR."
                    + "\nPREMIUM target total: about " + premiumTarget.toPlainString() + " INR."
                    + "\nReturn the alternatives JSON now.";
            JsonNode raw = groq.chatJson(List.of(GroqClient.Msg.system(ALTERNATIVES_SYSTEM), GroqClient.Msg.user(user)),
                    Math.min(4000, props.groq().maxTokens()));

            Set<PlanType> done = new HashSet<>();
            for (JsonNode alt : raw.path("alternatives")) {
                PlanType type = PlanType.from(alt.path("planType").asText(null));
                if (!alt.isObject() || type == null || type == PlanType.BUDGET || !done.add(type)) continue;

                List<String> issues = new ArrayList<>();
                List<ExpenseLine> lines = budgetEngine.parseLines(alt.path("expenseItems"), issues);
                if (lines.isEmpty()) {
                    warnings.add("The " + type.name() + " alternative had no usable cost lines and was left out.");
                    continue;
                }
                BudgetEngine.Summary s = budgetEngine.summarise(lines, budget);
                ObjectNode node = alt.deepCopy();
                node.remove("expenseItems");
                normalizeDataTypes(node.path("transportation"));
                normalizeDataTypes(node.path("accommodation"));

                BigDecimal target = target(budget, type);
                ObjectNode ex = budgetEngine.toJson(s);
                ex.put("planType", type.name());
                ex.put("targetMultiplier", type.multiplier());
                ex.put("targetAmount", target);
                BigDecimal ratio = s.total().divide(target, 4, RoundingMode.HALF_UP);
                ex.put("withinTarget", ratio.compareTo(new BigDecimal("0.85")) >= 0
                        && ratio.compareTo(new BigDecimal("1.10")) <= 0);
                node.set("expenses", ex);
                out.add(node);
                allLines.put(type, lines);
                issues.forEach(i -> warnings.add(type.name() + ": " + i));
            }
        } catch (AiServiceException e) {
            log.warn("Alternatives generation failed: {}", e.getMessage());
            warnings.add("Comfort and Premium alternatives couldn't be generated this time.");
        }
        return out;
    }

    private static BigDecimal target(BigDecimal budget, PlanType t) {
        return budget.multiply(BigDecimal.valueOf(t.multiplier())).setScale(0, RoundingMode.HALF_UP);
    }

    /** Nothing here is a live price (no provider connected), so LIVE is downgraded and missing tags default to ESTIMATED. */
    private void normalizeDataTypes(JsonNode array) {
        if (array == null || !array.isArray()) return;
        for (JsonNode n : array) {
            if (!n.isObject()) continue;
            DataType dt = DataType.from(n.path("dataType").asText(null));
            ((ObjectNode) n).put("dataType", (dt == DataType.LIVE ? DataType.ESTIMATED : dt).name());
        }
    }

    private String toJson(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise AI context", e);
        }
    }

    // ------------------------------------------------------------------ prompts

    private static final String PRIMARY_SYSTEM = """
        You are Naavi, an expert trip planner for Indian travellers. Using the TRIP CONTEXT you are given, produce a practical,
        budget-aware, day-wise itinerary. Respond with ONE valid JSON object only (no markdown, no commentary) in this shape:

        {
          "tripSummary": {"title": "", "highlights": [""], "bestTimeNote": ""},
          "transportation": [
                        {"direction": "ONWARD | RETURN", "mode": "TRAIN | BUS | FLIGHT | CAB", "from": "", "to": "", "durationHours": 0,
                         "trainName": "", "trainNumber": "", "travelClass": "", "departureTime": "", "arrivalTime": "",
                         "costPerPerson": 0, "fareNote": "", "suitability": "", "notes": "", "recommended": true, "dataType": "ESTIMATED"}
          ],
          "accommodation": [
            {"name": "", "area": "", "category": "", "pricePerNight": 0, "nights": 0, "rooms": 0, "rating": 0,
             "nearAttractions": "", "amenities": [""], "suitability": "", "recommended": true, "dataType": "ESTIMATED"}
          ],
          "days": [
            {"dayNumber": 1, "theme": "", "weatherNote": "",
             "activities": [
               {"time": "08:00", "type": "TRAVEL | CHECKIN | CHECKOUT | MEAL | SIGHTSEEING | ACTIVITY | LOCAL_TRANSPORT | REST",
                "title": "", "description": "", "area": "", "durationMinutes": 0, "entryFeePerPerson": 0,
                "openingHours": "", "travelFromPrevious": "", "indoor": false}
             ]}
          ],
          "expenseItems": [
            {"category": "TRANSPORTATION | ACCOMMODATION | FOOD | LOCAL_TRANSPORT | ACTIVITIES | MISCELLANEOUS",
             "description": "", "unitCost": 0, "quantity": 0, "dataType": "ESTIMATED"}
          ],
          "packingChecklist": [""],
          "reductionSuggestions": [""]
        }

        MONEY RULES (the backend does the arithmetic, you only supply unit prices and quantities):
        - All amounts are INR, plain numbers, no currency symbols, no ranges. Put price ranges in "notes" text instead.
        - Each expense item has unitCost and quantity; quantity already includes the multiplier. Examples: hotel -> unitCost = price per
          room per night, quantity = nights x rooms; train/bus/flight -> unitCost = fare per person one way, quantity = travellers per leg
          (list ONWARD and RETURN as separate items); food -> unitCost per person per day, quantity = travellers x days (add a separate
          snack line if useful); local transport -> unitCost per ride/day, quantity = number of rides/days; activities -> entry fee per
          person x travellers.
        - Cover every category: TRANSPORTATION (both directions), ACCOMMODATION, FOOD, LOCAL_TRANSPORT, ACTIVITIES, MISCELLANEOUS.
        - Expense items MUST match what the itinerary shows (same transport, stay, attractions, fees).
        - Aim for a total of about 80-90% of the user's budget, leaving a 10% buffer. Never exceed the budget unless it is genuinely
          impossible, and then keep the overrun as small as possible and fill "reductionSuggestions" with 3 concrete ways to cut cost.
        - dataType is "ESTIMATED" for anything you are not given in the context. Use "USER_PROVIDED" only for figures the user stated.
          Never use "LIVE" unless the context supplies live data for that item. Do not claim exact or guaranteed prices.
        TRAINS AND HOTELS (shown to the user for booking):
                     - When the intercity mode is TRAIN, give a REAL, well-known train that runs on that route: "trainName" (e.g. "Goa Express"),
                       "trainNumber", "travelClass" (SL, 3A, 2A, CC...), approximate departure/arrival times, and "costPerPerson" = typical fare for
                       that class. Put the fare band in "fareNote" (e.g. "approx 1,400-1,600 depending on quota"). Offer at least one train per
                       direction, and a second option if possible. Use TRAIN only if a train is realistic for the route; otherwise use another mode.
                       If unsure of the exact number, give the name and leave trainNumber empty. Never invent a train.
                     - Every "accommodation" entry must be a REAL, well-known hotel/stay with its actual name in "name" (no placeholders such as
                       "Budget Hotel") and its "area". Do NOT output URLs; the backend adds booking links.

        TOOL DATA (backend tools ran before you; use their output instead of inventing numbers):
        - context.budgetGuide holds suggested caps: transportCapPerPersonRoundTrip and hotelCapPerRoomNight. Prefer options under them.
        - If context.travelData.options is present, build every "transportation" entry from those options: copy mode, travelClass,
          durationHours and use costPerPersonOneWay as costPerPerson and as the expense unitCost. Start from the option marked
          recommended=true unless the user's preferences or modificationInstructions point to another one. For TRAIN you may still add
          a well-known real trainName/trainNumber for that route, but never change the fare. If travelData.anyOptionFitsBudget is false,
          say so in "notes" and fill "reductionSuggestions".
        - If context.hotelData.options is present, every "accommodation" entry must be one of those options: copy name and area, use
          estimatedPricePerRoomNight as pricePerNight and as the expense unitCost, and set rating to 0 (no rating data exists).
          Do not invent amenities. Prefer options with fitsNightlyBudget=true and matchesPreference=true.
        - If a tool's status is NOT_AVAILABLE, fall back to realistic estimates for that part and keep dataType ESTIMATED.

        PLANNING RULES:
        - "days" must have exactly tripRequest.days entries. Day 1 begins with the onward journey; the last day ends with the return.
        - Times are 24-hour "HH:mm", ascending within each day. Include meals, check-in/out and rest. Allow realistic travel time and
          traffic. Respect typical opening hours; never schedule a place when it is likely closed.
        - Cluster each day by area (fill "area" for every non-travel activity) and use at most 3 areas per day. Do not put geographically
          distant places on the same day. At most 4-5 attractions/activities per day; keep the pace consistent with preferences.tripPace
          and travelStyle.
        - Weather-aware: use context.weather. If rain/storm/very hot is expected on a day, move outdoor sightseeing to a better day or swap in
          indoor options, and say so in that day's "weatherNote". If no forecast is available, say so.
        - Honour context.preferences (food, local travel, accommodation, travel style, transportation) and additionalPreferenceNotes.
          context.tripOverrides always win over saved preferences. Food must respect the dietary preference in every meal you name.
          Local transport lines must follow localTravelPreference (e.g. PUBLIC_TRANSPORT -> metro/bus/shared first).
        - Honour tripRequest.specialRequirements (e.g. family-friendly, suitable for parents, accessibility).
        - If context.previousItinerary and context.modificationInstructions are present, this is a revision: apply the instructions to the
          previous itinerary, keep what the user didn't ask to change, and rebuild the whole JSON with updated costs.
        - Use only real, well-known places and realistic Indian prices. If you are unsure of a specific name, prefer a well-known option.
        """;

    private static final String ALTERNATIVES_SYSTEM = """
        You are Naavi, an expert trip planner. A budget plan has already been built (see PRIMARY PLAN). Now design two upgrade
        alternatives for the SAME trip (same dates, destination, travellers) and respond with ONE valid JSON object only:

        {
          "alternatives": [
            {
              "planType": "COMFORT",
              "title": "", "summary": "", "highlights": [""],
              "transportation": [{"direction": "ONWARD | RETURN", "mode": "", "from": "", "to": "", "durationHours": 0,
                                  "trainName": "", "trainNumber": "", "travelClass": "", "costPerPerson": 0, "fareNote": "", "notes": "",
                                  "dataType": "ESTIMATED"}],
              "accommodation": [{"name": "", "area": "", "category": "", "pricePerNight": 0, "nights": 0, "rooms": 0,
                                 "rating": 0, "amenities": [""], "dataType": "ESTIMATED"}],
              "upgrades": [""],
              "dayChanges": [{"dayNumber": 1, "change": ""}],
              "expenseItems": [{"category": "TRANSPORTATION | ACCOMMODATION | FOOD | LOCAL_TRANSPORT | ACTIVITIES | MISCELLANEOUS",
                                "description": "", "unitCost": 0, "quantity": 0, "dataType": "ESTIMATED"}]
            },
            { "planType": "PREMIUM", ...same shape... }
          ]
        }

        RULES:
        - COMFORT total should land near its target (about 1.2x the user's budget), PREMIUM near its target (about 1.5x). Stay within +/-8%.
        - Do NOT just scale every cost. Spend the extra money where it changes the experience: better-located or higher-category stay,
          faster/more comfortable transport (e.g. AC class, flight, private cab), better dining, one or two extra experiences, more flexibility
          in the schedule. Say exactly what was upgraded in "upgrades" and "dayChanges".
        - Name real trains (trainName, trainNumber, travelClass) when mode is TRAIN, and real hotels by their actual names. No URLs.
        - When context.travelData.options / context.hotelData.options exist, pick transport and stays from them (e.g. a higher train class,
          a flight or cab from travelData; a higher-tier stay from hotelData) and keep their fares and prices unchanged.
        - Same money rules as the primary plan: unitCost and quantity per expense item (quantity includes travellers/nights/days),
          INR plain numbers, cover all six categories, items must match the transport/stay described. dataType is ESTIMATED unless the user
          provided the figure. Honour all preferences and tripOverrides in the context (e.g. vegetarian food, preferred local transport).
        """;
}
