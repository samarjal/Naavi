package com.naavi.service;

import com.naavi.dto.Dto.OverridesDto;
import com.naavi.dto.Dto.TripRequest;
import com.naavi.entity.Trip;
import com.naavi.entity.TripPreferenceOverride;
import com.naavi.exception.BadRequestException;
import com.naavi.exception.NotFoundException;
import com.naavi.model.TripStatus;
import com.naavi.repository.*;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TripService {
    private final TripRepository trips;
    private final TripPreferenceOverrideRepository overrides;
    private final ItineraryRepository itineraries;
    private final ExpenseRepository expenses;
    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;

    /** Ownership-checked load. Returns 404 (not 403) for other users' trips so existence isn't leaked. */
    @Transactional(readOnly = true)
    public Trip getOwned(Long userId, Long tripId) {
        return trips.findByIdAndUserId(tripId, userId).orElseThrow(() -> new NotFoundException("Trip not found"));
    }

    @Transactional(readOnly = true)
    public List<Trip> list(Long userId) {
        return trips.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Transactional
    public Trip createDraft(Long userId) {
        Trip t = new Trip();
        t.setUserId(userId);
        t.setTitle("New trip");
        t.setStatus(TripStatus.DRAFT);
        return trips.save(t);
    }

    @Transactional
    public Trip create(Long userId, TripRequest r) {
        Trip t = new Trip();
        t.setUserId(userId);
        t.setStatus(TripStatus.DRAFT);
        applyRequest(t, r);
        t = trips.save(t);
        if (r.overrides() != null && !r.overrides().isEmpty()) mergeOverride(t.getId(), r.overrides());
        return t;
    }

    @Transactional
    public Trip update(Long userId, Long tripId, TripRequest r) {
        Trip t = getOwned(userId, tripId);
        applyRequest(t, r);
        t = trips.save(t);
        if (r.overrides() != null && !r.overrides().isEmpty()) mergeOverride(t.getId(), r.overrides());
        return t;
    }

    @Transactional
    public Trip save(Trip t) {
        return trips.save(t);
    }

    @Transactional
    public void delete(Long userId, Long tripId) {
        Trip t = getOwned(userId, tripId);
        expenses.deleteByTripId(t.getId());
        messages.deleteByTripId(t.getId());
        conversations.deleteByTripId(t.getId());
        itineraries.deleteByTripId(t.getId());
        overrides.deleteByTripId(t.getId());
        trips.delete(t);
    }

    @Transactional(readOnly = true)
    public Optional<TripPreferenceOverride> getOverride(Long tripId) {
        return overrides.findByTripId(tripId);
    }

    /** Non-null fields replace what's stored; null fields are left alone. */
    @Transactional
    public TripPreferenceOverride mergeOverride(Long tripId, OverridesDto o) {
        TripPreferenceOverride ov = overrides.findByTripId(tripId).orElseGet(() -> {
            TripPreferenceOverride n = new TripPreferenceOverride();
            n.setTripId(tripId);
            return n;
        });
        if (o.foodPreference() != null) ov.setFoodPreference(o.foodPreference());
        if (o.localTravelPreference() != null) ov.setLocalTravelPreference(o.localTravelPreference());
        if (o.accommodationPreference() != null) ov.setAccommodationPreference(o.accommodationPreference());
        if (o.travelStyle() != null) ov.setTravelStyle(o.travelStyle());
        if (o.transportationPreference() != null) ov.setTransportationPreference(o.transportationPreference());
        if (o.notes() != null && !o.notes().isBlank()) ov.setNotes(o.notes().trim());
        return overrides.save(ov);
    }


    private void applyRequest(Trip t, TripRequest r) {
        boolean datesChanged = r.startDate() != null || r.endDate() != null;
        if (r.source() != null) t.setSource(blankToNull(r.source()));
        if (r.destination() != null) t.setDestination(blankToNull(r.destination()));
        if (r.budget() != null) t.setBudget(r.budget());
        if (r.travelers() != null) t.setTravelers(r.travelers());
        if (r.days() != null) t.setDays(r.days());
        if (r.startDate() != null) t.setStartDate(r.startDate());
        if (r.endDate() != null) t.setEndDate(r.endDate());
        if (r.specialRequirements() != null) t.setSpecialRequirements(blankToNull(r.specialRequirements()));
        normalizeSchedule(t, datesChanged);
        refreshTitle(t);
    }

    /**
     * Keeps days / startDate / endDate consistent.
     * If dates were just changed, days follows the dates; otherwise (days changed) endDate follows days.
     */
    public void normalizeSchedule(Trip t, boolean datesChanged) {
        if (t.getStartDate() != null && t.getEndDate() != null) {
            if (t.getEndDate().isBefore(t.getStartDate())) {
                throw new BadRequestException("End date cannot be before start date.");
            }
            int span = (int) ChronoUnit.DAYS.between(t.getStartDate(), t.getEndDate()) + 1;
            if (datesChanged || t.getDays() == null) {
                t.setDays(span);
            } else if (t.getDays() != span) {
                t.setEndDate(t.getStartDate().plusDays(t.getDays() - 1L));
            }
        } else if (t.getStartDate() != null && t.getDays() != null) {
            t.setEndDate(t.getStartDate().plusDays(t.getDays() - 1L));
        }
        if (t.getDays() != null && (t.getDays() < 1 || t.getDays() > 30)) {
            throw new BadRequestException("Trip length must be between 1 and 30 days.");
        }
    }

    public void refreshTitle(Trip t) {
        if (t.getDestination() != null) {
            t.setTitle(t.getSource() != null ? t.getSource() + " → " + t.getDestination() : "Trip to " + t.getDestination());
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
