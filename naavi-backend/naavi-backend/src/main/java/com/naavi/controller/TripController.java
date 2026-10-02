package com.naavi.controller;

import com.naavi.dto.Dto.*;
import com.naavi.entity.Itinerary;
import com.naavi.entity.Trip;
import com.naavi.service.ItineraryService;
import com.naavi.service.Mapper;
import com.naavi.service.TripService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {
    private final TripService trips;
    private final ItineraryService itineraries;

    @PostMapping
    public ResponseEntity<TripDto> create(@AuthenticationPrincipal Long userId, @Valid @RequestBody TripRequest r) {
        Trip t = trips.create(userId, r);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto(t));
    }

    @GetMapping
    public List<TripDto> list(@AuthenticationPrincipal Long userId) {
        return trips.list(userId).stream().map(t -> Mapper.trip(t, null)).toList();
    }

    @GetMapping("/{tripId}")
    public TripDetailDto get(@AuthenticationPrincipal Long userId, @PathVariable Long tripId) {
        Trip t = trips.getOwned(userId, tripId);
        Optional<Itinerary> latest = itineraries.latest(tripId);
        return new TripDetailDto(dto(t),
                latest.map(Itinerary::getVersion).orElse(null),
                latest.map(itineraries::readPlan).orElse(null));
    }

    @PutMapping("/{tripId}")
    public TripDto update(@AuthenticationPrincipal Long userId, @PathVariable Long tripId,
                          @Valid @RequestBody TripRequest r) {
        return dto(trips.update(userId, tripId, r));
    }

    @DeleteMapping("/{tripId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long userId, @PathVariable Long tripId) {
        trips.delete(userId, tripId);
        return ResponseEntity.noContent().build();
    }

    private TripDto dto(Trip t) {
        return Mapper.trip(t, trips.getOverride(t.getId()).orElse(null));
    }
}
