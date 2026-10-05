package com.naavi.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Place name -> coordinates (Open-Meteo geocoding, free, no key) plus distance maths. */
@Component
public class GeoService {
    private static final Logger log = LoggerFactory.getLogger(GeoService.class);

    public record Place(String name, String admin1, String countryCode, String featureCode,
                        double lat, double lon) {
        /** Regions (states/districts/countries) are large, so searches around them need a wider radius. */
        public boolean isRegion() {
            return featureCode != null && (featureCode.startsWith("ADM") || featureCode.startsWith("PCL"));
        }
    }

    private final ObjectMapper mapper;
    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final Map<String, Place> cache = new ConcurrentHashMap<>();

    public GeoService(ObjectMapper mapper,
                      @Value("${naavi.tools.geocoding-url:https://geocoding-api.open-meteo.com}") String baseUrl) {
        this.mapper = mapper;
        this.baseUrl = baseUrl;
    }

    /** Prefers an Indian match when several places share the name (the app targets Indian trips). */
    public Optional<Place> locate(String query) {
        if (query == null || query.isBlank()) return Optional.empty();
        String key = query.trim().toLowerCase();
        Place cached = cache.get(key);
        if (cached != null) return Optional.of(cached);
        try {
            String url = baseUrl + "/v1/search?count=5&language=en&format=json&name="
                    + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            HttpResponse<String> res = http.send(
                    HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                log.warn("Geocoding '{}' returned HTTP {}", query, res.statusCode());
                return Optional.empty();
            }
            JsonNode results = mapper.readTree(res.body()).path("results");
            if (!results.isArray() || results.isEmpty()) return Optional.empty();
            JsonNode pick = results.get(0);
            for (JsonNode r : results) {
                if ("IN".equalsIgnoreCase(r.path("country_code").asText(""))) {
                    pick = r;
                    break;
                }
            }
            Place p = new Place(pick.path("name").asText(query), pick.path("admin1").asText(null),
                    pick.path("country_code").asText(null), pick.path("feature_code").asText(null),
                    pick.path("latitude").asDouble(), pick.path("longitude").asDouble());
            cache.put(key, p);
            return Optional.of(p);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Geocoding '{}' failed: {}", query, e.getMessage());
            return Optional.empty();
        }
    }

    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * r * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    public static double haversineKm(Place a, Place b) {
        return haversineKm(a.lat(), a.lon(), b.lat(), b.lon());
    }
}
