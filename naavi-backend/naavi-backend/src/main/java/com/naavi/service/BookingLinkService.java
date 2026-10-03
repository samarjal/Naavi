package com.naavi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.entity.Trip;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

/**
 * Adds booking links to hotels and trains.
 *
 * Links are built here, never taken from the LLM (models invent URLs). They are search deep links
 * pre-filled with the hotel name, destination, dates and guests, so the user lands on a ready search
 * and books in one or two clicks. Exact property pages need a live provider (see TravelDataProvider).
 */
@Component
public class BookingLinkService {
    private static final String IRCTC = "https://www.irctc.co.in/nget/train-search";

    public void enrich(ObjectNode plan, Trip trip) {
        addLinks(plan.path("transportation"), plan.path("accommodation"), trip);
        JsonNode alts = plan.path("alternatives");
        if (alts.isArray()) {
            for (JsonNode alt : alts) addLinks(alt.path("transportation"), alt.path("accommodation"), trip);
        }
    }

    private void addLinks(JsonNode transport, JsonNode stays, Trip trip) {
        if (transport != null && transport.isArray()) {
            for (JsonNode t : transport) {
                if (!t.isObject()) continue;
                ObjectNode o = (ObjectNode) t;
                if (isTrain(o)) {
                    o.put("bookingUrl", IRCTC);
                    o.put("bookingProvider", "IRCTC");
                    LocalDate d = "RETURN".equalsIgnoreCase(o.path("direction").asText())
                            ? trip.getEndDate() : trip.getStartDate();
                    o.put("bookingNote", "Search " + o.path("from").asText("") + " to " + o.path("to").asText("")
                            + (o.hasNonNull("trainNumber") ? ", train " + o.path("trainNumber").asText() : "")
                            + (d != null ? " on " + d : "") + ". Check live fare and seat availability.");
                }
            }
        }
        if (stays != null && stays.isArray()) {
            for (JsonNode s : stays) {
                if (!s.isObject() || s.path("name").asText("").isBlank()) continue;
                ObjectNode o = (ObjectNode) s;
                String query = o.path("name").asText() + " " + trip.getDestination();
                int rooms = Math.max(1, o.path("rooms").asInt(1));
                StringBuilder b = new StringBuilder("https://www.booking.com/searchresults.html?ss=").append(enc(query))
                        .append("&group_adults=").append(Math.max(1, trip.getTravelers() == null ? 1 : trip.getTravelers()))
                        .append("&no_rooms=").append(rooms);
                if (trip.getStartDate() != null) b.append("&checkin=").append(trip.getStartDate());
                if (trip.getEndDate() != null) b.append("&checkout=").append(trip.getEndDate());
                o.put("bookingUrl", b.toString());
                o.put("bookingProvider", "Booking.com");
                o.put("alternateBookingUrl", "https://www.google.com/travel/hotels?q=" + enc(query));
            }
        }
    }

    private static boolean isTrain(ObjectNode o) {
        return o.path("mode").asText("").toLowerCase().contains("train") || o.hasNonNull("trainNumber");
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}