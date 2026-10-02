package com.naavi.service;

import com.naavi.entity.TripPreferenceOverride;
import com.naavi.entity.UserPreference;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Priority: trip-specific override  >  saved user preference  >  system default. */
@Component
public class PreferenceResolver {

    public record EffectivePreferences(Map<String, String> values, Map<String, String> sources,
                                       Map<String, String> notes) {}

    public EffectivePreferences resolve(UserPreference saved, TripPreferenceOverride ov) {
        Map<String, String> values = new LinkedHashMap<>();
        Map<String, String> sources = new LinkedHashMap<>();
        pick(values, sources, "foodPreference",
                ov == null ? null : ov.getFoodPreference(), saved == null ? null : saved.getFoodPreference(), "NO_PREFERENCE");
        pick(values, sources, "localTravelPreference",
                ov == null ? null : ov.getLocalTravelPreference(), saved == null ? null : saved.getLocalTravelPreference(), "NO_PREFERENCE");
        pick(values, sources, "accommodationPreference",
                ov == null ? null : ov.getAccommodationPreference(), saved == null ? null : saved.getAccommodationPreference(), "NO_PREFERENCE");
        pick(values, sources, "travelStyle",
                ov == null ? null : ov.getTravelStyle(), saved == null ? null : saved.getTravelStyle(), "RELAXED");
        pick(values, sources, "transportationPreference",
                ov == null ? null : ov.getTransportationPreference(), saved == null ? null : saved.getTransportationPreference(), "NO_PREFERENCE");

        Map<String, String> notes = new LinkedHashMap<>();
        if (saved != null) {
            put(notes, "dietaryNotes", saved.getDietaryNotes());
            put(notes, "preferredActivities", saved.getPreferredActivities());
            put(notes, "walkingTolerance", saved.getWalkingTolerance());
            put(notes, "accessibilityRequirements", saved.getAccessibilityRequirements());
            put(notes, "preferredAccommodationArea", saved.getPreferredAccommodationArea());
            put(notes, "tripPace", saved.getTripPace());
        }
        if (ov != null) put(notes, "tripSpecificNotes", ov.getNotes());
        return new EffectivePreferences(values, sources, notes);
    }

    private static void pick(Map<String, String> values, Map<String, String> sources, String key,
                             Enum<?> trip, Enum<?> saved, String def) {
        if (trip != null) {
            values.put(key, trip.name());
            sources.put(key, "TRIP_OVERRIDE");
        } else if (saved != null) {
            values.put(key, saved.name());
            sources.put(key, "SAVED_PREFERENCE");
        } else {
            values.put(key, def);
            sources.put(key, "SYSTEM_DEFAULT");
        }
    }

    private static void put(Map<String, String> m, String k, String v) {
        if (v != null && !v.isBlank()) m.put(k, v);
    }
}
