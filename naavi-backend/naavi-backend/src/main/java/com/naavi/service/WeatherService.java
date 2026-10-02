package com.naavi.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Live forecast from Open-Meteo (free, no API key). */
@Service
@Slf4j
public class WeatherService {
    /** Open-Meteo serves at most 16 days: today .. today+15. */
    private static final int HORIZON_DAYS = 15;

    private final RestClient geocoding = RestClient.create("https://geocoding-api.open-meteo.com");
    private final RestClient forecast = RestClient.create("https://api.open-meteo.com");

    public record WeatherDay(LocalDate date, Double tempMaxC, Double tempMinC, String condition,
                             Integer rainChancePercent) {}

    /** mode: TRIP_DATES | UPCOMING | UNAVAILABLE. All returned values are live provider data. */
    public record WeatherResult(String location, String mode, String note, String dataType, List<WeatherDay> days) {}

    public WeatherResult get(String destination, LocalDate start, LocalDate end) {
        try {
            JsonNode geo = geocoding.get()
                    .uri(u -> u.path("/v1/search").queryParam("name", "{n}").queryParam("count", 1)
                            .queryParam("language", "en").queryParam("format", "json").build(destination))
                    .retrieve().body(JsonNode.class);
            JsonNode place = geo == null ? null : geo.path("results").path(0);
            if (place == null || place.isMissingNode() || place.isNull()) {
                return unavailable(destination, "Couldn't locate '" + destination + "' for a weather forecast.");
            }
            double lat = place.path("latitude").asDouble();
            double lon = place.path("longitude").asDouble();
            String resolved = place.path("name").asText(destination);

            LocalDate today = LocalDate.now();
            LocalDate last = today.plusDays(HORIZON_DAYS);
            LocalDate from;
            LocalDate to;
            String mode;
            String note = null;
            if (start != null && !start.isBefore(today) && !start.isAfter(last)) {
                from = start;
                LocalDate wanted = end != null ? end : start;
                to = wanted.isAfter(last) ? last : wanted;
                mode = "TRIP_DATES";
                if (wanted.isAfter(last)) {
                    note = "Forecast is only available up to " + last + "; later days of the trip are not covered yet.";
                }
            } else {
                from = today;
                to = today.plusDays(2);
                mode = "UPCOMING";
                note = start != null
                        ? "A forecast for your travel dates isn't available yet (max 16 days ahead); showing the next 3 days instead."
                        : "No travel dates were given, so this shows the next 3 days.";
            }

            JsonNode f = forecast.get()
                    .uri(u -> u.path("/v1/forecast").queryParam("latitude", lat).queryParam("longitude", lon)
                            .queryParam("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max")
                            .queryParam("timezone", "auto").queryParam("start_date", from.toString())
                            .queryParam("end_date", to.toString()).build())
                    .retrieve().body(JsonNode.class);

            JsonNode daily = f == null ? null : f.path("daily");
            List<WeatherDay> days = new ArrayList<>();
            if (daily != null && daily.path("time").isArray()) {
                for (int i = 0; i < daily.path("time").size(); i++) {
                    days.add(new WeatherDay(
                            LocalDate.parse(daily.path("time").get(i).asText()),
                            num(daily.path("temperature_2m_max"), i),
                            num(daily.path("temperature_2m_min"), i),
                            describe(daily.path("weather_code").path(i).asInt(-1)),
                            daily.path("precipitation_probability_max").path(i).isNumber()
                                    ? daily.path("precipitation_probability_max").path(i).asInt() : null));
                }
            }
            if (days.isEmpty()) return unavailable(destination, "The weather provider returned no forecast data.");
            return new WeatherResult(resolved, mode, note, "LIVE", days);
        } catch (Exception e) {
            log.warn("Weather lookup failed for '{}': {}", destination, e.getMessage());
            return unavailable(destination, "Weather data couldn't be retrieved right now.");
        }
    }

    private static WeatherResult unavailable(String location, String note) {
        return new WeatherResult(location, "UNAVAILABLE", note, "LIVE", List.of());
    }

    private static Double num(JsonNode arr, int i) {
        JsonNode n = arr.path(i);
        return n.isNumber() ? n.asDouble() : null;
    }

    /** WMO weather interpretation codes. */
    static String describe(int code) {
        if (code == 0) return "Clear sky";
        if (code == 1) return "Mainly clear";
        if (code == 2) return "Partly cloudy";
        if (code == 3) return "Overcast";
        if (code == 45 || code == 48) return "Fog";
        if (code >= 51 && code <= 57) return "Drizzle";
        if (code >= 61 && code <= 67) return "Rain";
        if (code >= 71 && code <= 77) return "Snow";
        if (code >= 80 && code <= 82) return "Rain showers";
        if (code == 85 || code == 86) return "Snow showers";
        if (code >= 95) return "Thunderstorm";
        return "Unknown";
    }
}
