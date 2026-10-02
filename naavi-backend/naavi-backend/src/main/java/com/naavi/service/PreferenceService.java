package com.naavi.service;

import com.naavi.dto.Dto.PreferenceRequest;
import com.naavi.entity.User;
import com.naavi.entity.UserPreference;
import com.naavi.exception.BadRequestException;
import com.naavi.exception.ConflictException;
import com.naavi.exception.NotFoundException;
import com.naavi.repository.UserPreferenceRepository;
import com.naavi.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PreferenceService {
    private final UserPreferenceRepository prefs;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public Optional<UserPreference> find(Long userId) {
        return prefs.findByUserId(userId);
    }

    @Transactional(readOnly = true)
    public UserPreference get(Long userId) {
        return find(userId).orElseThrow(() ->
                new NotFoundException("Preferences not set yet. Complete onboarding first."));
    }

    /** Onboarding: first-time save. All five core preferences are required. */
    @Transactional
    public UserPreference create(Long userId, PreferenceRequest r) {
        if (prefs.findByUserId(userId).isPresent()) {
            throw new ConflictException("Preferences already exist. Use PUT to update them.");
        }
        requireCore(r);
        UserPreference p = new UserPreference();
        p.setUserId(userId);
        apply(p, r);
        UserPreference saved = prefs.save(p);
        markOnboarded(userId);
        return saved;
    }

    /** Profile/Settings edit. Null fields are left unchanged. Creates the row if missing. */
    @Transactional
    public UserPreference update(Long userId, PreferenceRequest r) {
        UserPreference p = prefs.findByUserId(userId).orElse(null);
        if (p == null) {
            requireCore(r);
            p = new UserPreference();
            p.setUserId(userId);
        }
        apply(p, r);
        UserPreference saved = prefs.save(p);
        markOnboarded(userId);
        return saved;
    }

    private void markOnboarded(Long userId) {
        User u = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        if (!u.isOnboardingCompleted()) {
            u.setOnboardingCompleted(true);
            users.save(u);
        }
    }

    private static void requireCore(PreferenceRequest r) {
        List<String> missing = new ArrayList<>();
        if (r.foodPreference() == null) missing.add("foodPreference");
        if (r.localTravelPreference() == null) missing.add("localTravelPreference");
        if (r.accommodationPreference() == null) missing.add("accommodationPreference");
        if (r.travelStyle() == null) missing.add("travelStyle");
        if (r.transportationPreference() == null) missing.add("transportationPreference");
        if (!missing.isEmpty()) throw new BadRequestException("Missing required preferences: " + String.join(", ", missing));
    }

    private static void apply(UserPreference p, PreferenceRequest r) {
        if (r.foodPreference() != null) p.setFoodPreference(r.foodPreference());
        if (r.localTravelPreference() != null) p.setLocalTravelPreference(r.localTravelPreference());
        if (r.accommodationPreference() != null) p.setAccommodationPreference(r.accommodationPreference());
        if (r.travelStyle() != null) p.setTravelStyle(r.travelStyle());
        if (r.transportationPreference() != null) p.setTransportationPreference(r.transportationPreference());
        if (r.dietaryNotes() != null) p.setDietaryNotes(clean(r.dietaryNotes()));
        if (r.preferredActivities() != null) p.setPreferredActivities(clean(r.preferredActivities()));
        if (r.walkingTolerance() != null) p.setWalkingTolerance(clean(r.walkingTolerance()));
        if (r.accessibilityRequirements() != null) p.setAccessibilityRequirements(clean(r.accessibilityRequirements()));
        if (r.preferredAccommodationArea() != null) p.setPreferredAccommodationArea(clean(r.preferredAccommodationArea()));
        if (r.tripPace() != null) p.setTripPace(clean(r.tripPace()));
    }

    /** Empty string clears the field. */
    private static String clean(String s) {
        return s.isBlank() ? null : s.trim();
    }
}
