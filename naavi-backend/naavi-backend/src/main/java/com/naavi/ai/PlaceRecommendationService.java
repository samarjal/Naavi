package com.naavi.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.entity.Trip;
import com.naavi.exception.AiServiceException;
import com.naavi.service.PreferenceResolver.EffectivePreferences;
import com.naavi.util.Money;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * "Where should I go?" mode: suggests destinations (beaches, mountains, ...) without building an itinerary.
 * Every number shown to the user is an estimate, and links are built here (never taken from the LLM).
 */
@Service
@RequiredArgsConstructor
public class PlaceRecommendationService {
    private static final int MAX_PLACES = 6;

    private final GroqClient groq;
    private final ObjectMapper mapper;

    public record Result(ObjectNode json, String reply) {}

    public Result recommend(Trip trip, EffectivePreferences prefs, String message, String placeQuery) {
        ObjectNode input = mapper.createObjectNode();
        input.put("today", LocalDate.now().toString());
        input.put("userMessage", message);
        input.put("whatTheyWant", placeQuery);
        input.put("startingCity", trip.getSource());
        if (trip.getBudget() != null) input.put("totalBudgetInr", trip.getBudget());
        if (trip.getTravelers() != null) input.put("travelers", trip.getTravelers());
        if (trip.getDays() != null) input.put("days", trip.getDays());
        if (trip.getStartDate() != null) input.put("startDate", trip.getStartDate().toString());
        input.set("preferences", mapper.valueToTree(prefs.values()));

        JsonNode raw = groq.chatJson(List.of(
                GroqClient.Msg.system(SYSTEM),
                GroqClient.Msg.user(input.toString())), 2500);

        ArrayNode places = mapper.createArrayNode();
        for (JsonNode p : raw.path("places")) {
            if (places.size() >= MAX_PLACES) break;
            if (!p.isObject() || p.path("name").asText("").isBlank()) continue;
            ObjectNode o = ((ObjectNode) p).deepCopy();
            String state = o.path("state").asText("");
            String q = o.path("name").asText() + (state.isBlank() ? "" : ", " + state);
            o.put("mapsUrl", "https://www.google.com/maps/search/?api=1&query="
                    + URLEncoder.encode(q, StandardCharsets.UTF_8));
            o.put("dataType", "ESTIMATED");
            places.add(o);
        }
        if (places.isEmpty()) {
            throw new AiServiceException("I couldn't come up with good suggestions this time. Please try rephrasing.");
        }

        String intro = raw.path("intro").asText("").trim();
        ObjectNode root = mapper.createObjectNode();
        root.put("query", placeQuery == null ? message : placeQuery);
        root.put("generatedAt", Instant.now().toString());
        root.set("places", places);
        root.put("dataNotice", "Costs, timings and seasons are ESTIMATED. Check current conditions before booking.");

        return new Result(root, buildReply(intro, places));
    }

    /** Deterministic reply text built from the validated data. Names come first so chat history keeps them. */
    private static String buildReply(String intro, ArrayNode places) {
        StringBuilder sb = new StringBuilder(intro.isEmpty() ? "Here are some places you might like." : intro);

        StringBuilder names = new StringBuilder();
        for (JsonNode p : places) {
            if (names.length() > 0) names.append(", ");
            names.append(p.path("name").asText());
        }
        sb.append("\n\nTop picks: ").append(names).append('.');

        int i = 1;
        for (JsonNode p : places) {
            sb.append("\n\n").append(i++).append(". ").append(p.path("name").asText());
            if (!p.path("state").asText("").isBlank()) sb.append(" (").append(p.path("state").asText()).append(")");
            if (!p.path("type").asText("").isBlank()) sb.append(" - ").append(p.path("type").asText());
            if (!p.path("whyVisit").asText("").isBlank()) sb.append("\n   ").append(p.path("whyVisit").asText());
            if (!p.path("bestTime").asText("").isBlank()) sb.append("\n   Best time: ").append(p.path("bestTime").asText());
            if (p.path("idealDays").isNumber()) sb.append("\n   Ideal stay: ").append(p.path("idealDays").asInt()).append(" days");
            if (p.path("estCostPerPersonPerDay").isNumber() && p.path("estCostPerPersonPerDay").asInt() > 0) {
                sb.append("\n   Est. spend: ").append(Money.inr(p.path("estCostPerPersonPerDay").decimalValue()))
                        .append(" per person per day");
            }
            if (!p.path("howToReach").asText("").isBlank()) sb.append("\n   How to reach: ").append(p.path("howToReach").asText());
        }
        sb.append("\n\nTell me which one you like, plus where you're starting from, your budget, number of travellers "
                + "and days, and I'll build the full itinerary with trains, fares and hotels.");
        return sb.toString();
    }

    private static final String SYSTEM = """
        You are Naavi, a travel expert for Indian travellers. The user is exploring and has not picked a destination yet.
        Suggest places that match what they want. Respond with ONE valid JSON object only (no markdown):

        {
          "intro": "one friendly sentence tailored to the request",
          "places": [
            {"name": "", "state": "", "type": "Beach | Hill station | Trek | Heritage | Wildlife | ...",
             "whyVisit": "one or two sentences", "highlights": [""],
             "bestTime": "e.g. Oct to Mar", "idealDays": 0,
             "estCostPerPersonPerDay": 0, "howToReach": "nearest railway station or airport from the user's city if known",
             "suitability": "who it suits, e.g. couples, families, solo, adventure"}
          ]
        }

        RULES:
        - Give exactly 5 places. Only REAL, well-known places in India (unless the user asks otherwise). Never invent a place.
        - Match "whatTheyWant" (for example beaches or mountains). Mix one or two famous choices with lesser-known ones.
        - Respect startingCity (prefer places reachable from there), totalBudgetInr, days, travelers and the season implied by
          startDate or today. If the budget looks too low for a place, leave it out or say so in whyVisit.
        - Honour preferences (travel style, food, accommodation) where relevant.
        - estCostPerPersonPerDay is a plain INR number covering stay, food and local travel, excluding intercity travel.
        - No URLs, no currency symbols in numbers, no price ranges (put ranges in text fields instead).
        """;
}