package com.naavi.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.naavi.tools.GeoService.Place;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Tool: search_accommodation(destination, nightly cap, guests, rooms, nights, preference).
 *
 * Property names, areas and coordinates are REAL, read from OpenStreetMap through the Overpass API (free, no key).
 * OpenStreetMap carries no prices or ratings, so the nightly price is a category-based ESTIMATE and no rating is
 * returned. The planner must therefore keep prices labelled ESTIMATED and must not invent ratings.
 */
@Component
public class AccommodationTool {
    private static final Logger log = LoggerFactory.getLogger(AccommodationTool.class);
    private static final long CACHE_TTL_MS = 12 * 60 * 60 * 1000L;
    private static final int MAX_RESULTS = 8;

    public enum Tier { HOSTEL, BUDGET, HOMESTAY, MID_RANGE, PREMIUM, RESORT }

    public record Listing(String name, String osmType, Integer stars, Tier tier, String area,
                          double lat, double lon, boolean hasWebsite, boolean hasPhone, double distanceKm) {}

    public record Option(String name, String category, String osmType, Integer stars, String area,
                         double distanceFromCenterKm, long estimatedPricePerRoomNight, String priceRange,
                         long estimatedStayTotal, Boolean fitsNightlyBudget, boolean matchesPreference,
                         boolean bestMatch, String dataType, String nameSource) {}

    private record Cached(long at, List<Listing> listings) {}

    private final ObjectMapper mapper;
    private final GeoService geo;
    private final List<String> endpoints;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public AccommodationTool(ObjectMapper mapper, GeoService geo,
                             @Value("${naavi.tools.overpass-urls:https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter}")
                             String endpointsCsv) {
        this.mapper = mapper;
        this.geo = geo;
        this.endpoints = List.of(endpointsCsv.split("\\s*,\\s*"));
    }

    public Map<String, Object> search(String destination, BigDecimal capPerRoomNight, int travelers, int rooms,
                                      int nights, String preference) {
        Place place = geo.locate(destination).orElse(null);
        if (place == null) {
            return unavailable("Couldn't locate '" + destination + "', so no stays could be looked up.");
        }
        List<Listing> listings = listings(place);
        if (listings.isEmpty()) {
            return unavailable("No named stays were found around " + place.name() + ".");
        }
        int guestsPerRoom = (int) Math.ceil(Math.max(1, travelers) / (double) Math.max(1, rooms));
        List<Option> options = rank(listings, capPerRoomNight, guestsPerRoom, Math.max(1, rooms), Math.max(1, nights), preference);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "LISTINGS_AVAILABLE");
        out.put("dataType", "ESTIMATED");
        out.put("source", "Names, areas and locations: OpenStreetMap (live). Prices: category-based estimate. No ratings available.");
        out.put("destination", place.name());
        out.put("guests", Math.max(1, travelers));
        out.put("rooms", Math.max(1, rooms));
        out.put("nights", Math.max(1, nights));
        out.put("hotelCapPerRoomNight", capPerRoomNight);
        out.put("options", options);
        out.put("note", "Choose stays ONLY from options. pricePerNight is per room per night and is an estimate; "
                + "do not add ratings or invent amenities. Hostel prices are per bed times guests per room.");
        return out;
    }

    // ------------------------------------------------------------------ ranking and pricing

    List<Option> rank(List<Listing> listings, BigDecimal cap, int guestsPerRoom, int rooms, int nights, String preference) {
        Tier wanted = parseTier(preference);
        record Scored(Listing l, long price, boolean fits, boolean match, double score) {}
        List<Scored> scored = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Listing l : listings) {
            if (!seen.add(l.name().toLowerCase(Locale.ROOT))) continue;
            long price = price(l, guestsPerRoom);
            boolean fits = cap == null || BigDecimal.valueOf(price).compareTo(cap) <= 0;
            boolean match = wanted == null || l.tier() == wanted
                    || (wanted == Tier.BUDGET && (l.tier() == Tier.HOMESTAY || l.tier() == Tier.HOSTEL));
            double richness = (l.stars() != null ? 2 : 0) + (l.hasWebsite() ? 1.5 : 0) + (l.hasPhone() ? 1 : 0)
                    + (l.area() != null ? 0.5 : 0);
            double score = (fits ? 0 : 1000) + (match ? 0 : 100) - richness * 4 + l.distanceKm();
            scored.add(new Scored(l, price, fits, match, score));
        }
        scored.sort(Comparator.comparingDouble(Scored::score));

        List<Option> out = new ArrayList<>();
        for (Scored s : scored) {
            if (out.size() >= MAX_RESULTS) break;
            Listing l = s.l();
            out.add(new Option(l.name(), l.tier().name(), l.osmType(), l.stars(), l.area(),
                    Math.round(l.distanceKm() * 10) / 10.0, s.price(),
                    "Rs " + fmt(round50(s.price() * 0.75)) + " - Rs " + fmt(round50(s.price() * 1.3)),
                    s.price() * rooms * nights, cap == null ? null : s.fits(), s.match(), out.isEmpty(),
                    "ESTIMATED", "OpenStreetMap"));
        }
        return out;
    }

    /** Estimated price per ROOM per night in INR (mid-season). */
    static long price(Listing l, int guestsPerRoom) {
        Integer st = l.stars();
        double p = switch (l.tier()) {
            case HOSTEL -> 800.0 * Math.max(1, guestsPerRoom); // per bed
            case HOMESTAY -> 1600;
            case RESORT -> st != null && st >= 4 ? 11000 : 7000;
            case PREMIUM -> st != null && st >= 5 ? 13000 : 6500;
            case MID_RANGE -> 3200;
            case BUDGET -> switch (l.osmType()) {
                case "guest_house" -> 1500;
                case "motel" -> 1800;
                default -> st == null ? 2200 : st <= 1 ? 1200 : 1800;
            };
        };
        return round50(p);
    }

    static Tier classify(String name, String type, Integer stars) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.contains("homestay") || n.contains("home stay")) return Tier.HOMESTAY;
        if (type.equals("hostel") || n.contains("hostel") || n.contains("backpackers")) return Tier.HOSTEL;
        if (type.equals("resort") || n.contains("resort")) return Tier.RESORT;
        if (stars != null) return stars >= 4 ? Tier.PREMIUM : stars == 3 ? Tier.MID_RANGE : Tier.BUDGET;
        if (type.equals("apartment")) return Tier.MID_RANGE;
        return Tier.BUDGET;
    }

    private static Tier parseTier(String preference) {
        if (preference == null) return null;
        return switch (preference.toUpperCase(Locale.ROOT)) {
            case "HOSTEL" -> Tier.HOSTEL;
            case "BUDGET" -> Tier.BUDGET;
            case "MID_RANGE" -> Tier.MID_RANGE;
            case "PREMIUM" -> Tier.PREMIUM;
            case "RESORT" -> Tier.RESORT;
            case "HOMESTAY" -> Tier.HOMESTAY;
            default -> null;
        };
    }

    // ------------------------------------------------------------------ Overpass

    private List<Listing> listings(Place place) {
        int radius = place.isRegion() ? 30_000 : 12_000;
        String key = String.format(Locale.ROOT, "%.2f,%.2f,%d", place.lat(), place.lon(), radius);
        Cached c = cache.get(key);
        long now = System.currentTimeMillis();
        if (c != null && now - c.at() < CACHE_TTL_MS) return c.listings();

        String query = String.format(Locale.ROOT,
                "[out:json][timeout:20];nwr[\"tourism\"~\"^(hotel|hostel|guest_house|motel|apartment|resort)$\"][\"name\"]"
                        + "(around:%d,%.5f,%.5f);out center tags 400;", radius, place.lat(), place.lon());
        for (String endpoint : endpoints) {
            try {
                HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(endpoint))
                                .timeout(Duration.ofSeconds(25))
                                .header("User-Agent", "naavi-backend/0.1 (travel planner)")
                                .header("Content-Type", "application/x-www-form-urlencoded")
                                .POST(HttpRequest.BodyPublishers.ofString(
                                        "data=" + URLEncoder.encode(query, StandardCharsets.UTF_8)))
                                .build(),
                        HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() != 200) {
                    log.warn("Overpass {} returned HTTP {}", endpoint, res.statusCode());
                    continue;
                }
                List<Listing> parsed = parse(mapper.readTree(res.body()), place);
                if (cache.size() > 200) cache.clear();
                if (!parsed.isEmpty()) cache.put(key, new Cached(now, parsed));
                return parsed;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return List.of();
            } catch (Exception e) {
                log.warn("Overpass {} failed: {}", endpoint, e.getMessage());
            }
        }
        return List.of();
    }

    List<Listing> parse(JsonNode root, Place center) {
        List<Listing> out = new ArrayList<>();
        for (JsonNode el : root.path("elements")) {
            JsonNode tags = el.path("tags");
            String name = tags.path("name").asText("").trim();
            if (name.isEmpty()) continue;
            double lat = el.has("lat") ? el.path("lat").asDouble() : el.path("center").path("lat").asDouble(Double.NaN);
            double lon = el.has("lon") ? el.path("lon").asDouble() : el.path("center").path("lon").asDouble(Double.NaN);
            if (Double.isNaN(lat) || Double.isNaN(lon)) continue;
            String type = tags.path("tourism").asText("hotel");
            Integer stars = stars(tags.path("stars").asText(null));
            String area = firstNonBlank(tags.path("addr:suburb").asText(null), tags.path("addr:place").asText(null),
                    tags.path("addr:city").asText(null), tags.path("addr:street").asText(null));
            out.add(new Listing(name, type, stars, classify(name, type, stars), area, lat, lon,
                    tags.hasNonNull("website") || tags.hasNonNull("contact:website"),
                    tags.hasNonNull("phone") || tags.hasNonNull("contact:phone"),
                    GeoService.haversineKm(center.lat(), center.lon(), lat, lon)));
        }
        return out;
    }

    private static Integer stars(String raw) {
        if (raw == null) return null;
        for (char ch : raw.toCharArray()) {
            if (ch >= '1' && ch <= '5') return ch - '0';
        }
        return null;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return null;
    }

    private static long round50(double v) {
        return Math.round(v / 50.0) * 50;
    }

    private static String fmt(long v) {
        return String.format(Locale.ROOT, "%,d", v);
    }

    private static Map<String, Object> unavailable(String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "NOT_AVAILABLE");
        m.put("note", note + " Use real, well-known stays with realistic Indian prices and label them ESTIMATED.");
        return m;
    }
}
