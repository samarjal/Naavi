package com.naavi.service;

import com.naavi.entity.Trip;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class NoLiveTravelDataProvider implements TravelDataProvider {
    private static final Map<String, Object> NONE = Map.of(
            "status", "NOT_AVAILABLE",
            "note", "No live provider is configured. Use realistic Indian market estimates and label them ESTIMATED.");

    @Override
    public Map<String, Object> fetch(Trip trip) {
        return Map.of("travelData", NONE, "hotelData", NONE, "placeData", NONE);
    }
}
