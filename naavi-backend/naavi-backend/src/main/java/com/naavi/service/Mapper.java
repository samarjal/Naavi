package com.naavi.service;

import com.naavi.dto.Dto.*;
import com.naavi.entity.*;

public final class Mapper {
    private Mapper() {}

    public static UserDto user(User u) {
        return new UserDto(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getProfilePictureUrl(),
                u.isOnboardingCompleted(), u.getCreatedAt());
    }

    public static PreferenceDto pref(UserPreference p) {
        return new PreferenceDto(p.getFoodPreference(), p.getLocalTravelPreference(), p.getAccommodationPreference(),
                p.getTravelStyle(), p.getTransportationPreference(), p.getDietaryNotes(), p.getPreferredActivities(),
                p.getWalkingTolerance(), p.getAccessibilityRequirements(), p.getPreferredAccommodationArea(),
                p.getTripPace(), p.getUpdatedAt());
    }

    public static OverridesDto overrides(TripPreferenceOverride o) {
        if (o == null) return null;
        return new OverridesDto(o.getFoodPreference(), o.getLocalTravelPreference(), o.getAccommodationPreference(),
                o.getTravelStyle(), o.getTransportationPreference(), o.getNotes());
    }

    public static TripDto trip(Trip t, TripPreferenceOverride o) {
        return new TripDto(t.getId(), t.getTitle(), t.getSource(), t.getDestination(), t.getBudget(), t.getTravelers(),
                t.getDays(), t.getStartDate(), t.getEndDate(), t.getSpecialRequirements(), t.getStatus(),
                overrides(o), t.getCreatedAt(), t.getUpdatedAt());
    }

    public static ChatMessageDto message(ChatMessage m) {
        return new ChatMessageDto(m.getId(), m.getRole().name(), m.getContent(), m.getCreatedAt());
    }
}
