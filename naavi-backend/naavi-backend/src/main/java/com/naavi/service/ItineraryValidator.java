package com.naavi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.naavi.entity.Trip;
import com.naavi.model.ExpenseCategory;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Sanity-checks the LLM's itinerary. Errors trigger one regeneration; warnings are surfaced to the client.
 */
@Component
public class ItineraryValidator {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("H:mm");
    private static final int MAX_ATTRACTIONS_PER_DAY = 5;
    private static final int MAX_AREAS_PER_DAY = 3;

    public record Result(List<String> errors, List<String> warnings) {
        public Result() { this(new ArrayList<>(), new ArrayList<>()); }

        public boolean valid() { return errors.isEmpty(); }
    }

    public Result validatePrimary(JsonNode raw, Trip trip) {
        Result r = new Result();
        if (raw == null || !raw.isObject()) {
            r.errors().add("The response must be a single JSON object.");
            return r;
        }
        JsonNode days = raw.path("days");
        if (!days.isArray() || days.isEmpty()) {
            r.errors().add("'days' must be a non-empty array.");
        } else {
            if (trip.getDays() != null && days.size() != trip.getDays()) {
                r.errors().add("'days' must contain exactly " + trip.getDays() + " entries but has " + days.size() + ".");
            }
            int n = 1;
            for (JsonNode d : days) checkDay(d, n++, r);
        }
        if (!nonEmptyArray(raw.get("transportation"))) {
            r.errors().add("'transportation' must list intercity options (onward and return).");
        }
        if (trip.getDays() != null && trip.getDays() > 1 && !nonEmptyArray(raw.get("accommodation"))) {
            r.errors().add("'accommodation' must list at least one stay.");
        }
        for (JsonNode t : raw.path("transportation")) {
            if (t.path("mode").asText("").equalsIgnoreCase("TRAIN") && t.path("trainName").asText("").isBlank()) {
                r.warnings().add("A train option has no train name.");
            }
        }
        for (JsonNode a : raw.path("accommodation")) {
            if (a.path("name").asText("").isBlank()) r.warnings().add("A stay has no hotel name.");
        }
        JsonNode items = raw.get("expenseItems");
        if (!nonEmptyArray(items)) {
            r.errors().add("'expenseItems' must be a non-empty array of {category, description, unitCost, quantity}.");
        } else {
            Set<ExpenseCategory> seen = EnumSet.noneOf(ExpenseCategory.class);
            for (JsonNode i : items) {
                ExpenseCategory c = ExpenseCategory.from(i.path("category").asText(null));
                if (c != null) seen.add(c);
            }
            for (ExpenseCategory c : ExpenseCategory.values()) {
                boolean oneDayNoStay = c == ExpenseCategory.ACCOMMODATION && trip.getDays() != null && trip.getDays() <= 1;
                if (!seen.contains(c) && !oneDayNoStay) {
                    r.warnings().add("The plan has no " + c.name() + " expense line.");
                }
            }
        }
        return r;
    }

    private void checkDay(JsonNode day, int n, Result r) {
        if (!day.isObject()) {
            r.errors().add("Day " + n + " must be an object.");
            return;
        }
        JsonNode acts = day.path("activities");
        if (!acts.isArray() || acts.size() < 4) {
            r.errors().add("Day " + n + " must have at least 4 scheduled items (meals, sights, check-in or travel). "
                    + "Add more activities, meals and an evening plan.");
            return;
        }
        LocalTime prev = null;
        boolean ordered = true;
        boolean badTime = false;
        boolean hasMeal = false;
        int attractions = 0;
        Set<String> areas = new HashSet<>();
        for (JsonNode a : acts) {
            String type = a.path("type").asText("").toUpperCase();
            if (type.equals("MEAL")) hasMeal = true;
            if (type.equals("SIGHTSEEING") || type.equals("ACTIVITY")) attractions++;
            String area = a.path("area").asText("").trim();
            if (!area.isEmpty() && !type.equals("TRAVEL") && !type.equals("LOCAL_TRANSPORT")) {
                areas.add(area.toLowerCase());
            }
            try {
                LocalTime t = LocalTime.parse(a.path("time").asText("").trim(), TIME);
                if (prev != null && t.isBefore(prev)) ordered = false;
                prev = t;
            } catch (Exception e) {
                badTime = true;
            }
        }
        if (badTime) r.warnings().add("Day " + n + " has activities with unreadable times (expected HH:mm).");
        if (!ordered) r.warnings().add("Day " + n + " has activities that are not in chronological order.");
        if (!hasMeal) r.warnings().add("Day " + n + " has no meal scheduled.");
        if (attractions > MAX_ATTRACTIONS_PER_DAY) {
            r.warnings().add("Day " + n + " may be overloaded (" + attractions + " attractions/activities).");
        }
        if (areas.size() > MAX_AREAS_PER_DAY) {
            r.warnings().add("Day " + n + " spans " + areas.size() + " different areas; travel between them may be tiring.");
        }
    }

    private static boolean nonEmptyArray(JsonNode n) {
        return n != null && n.isArray() && !n.isEmpty();
    }
}
