package com.naavi.controller;

import com.naavi.dto.Dto.*;
import com.naavi.service.TravelPlanningService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/travel")
@RequiredArgsConstructor
public class TravelController {
    private final TravelPlanningService planning;

    /** Start a new conversation/trip (no tripId) or continue an existing one. */
    @PostMapping("/plan")
    public ChatResponse plan(@AuthenticationPrincipal Long userId, @Valid @RequestBody PlanRequest r) {
        return planning.handle(userId, r.tripId(), r.message());
    }

    /** Change an existing itinerary, e.g. "make the hotel cheaper". */
    @PostMapping("/plan/{tripId}/modify")
    public ChatResponse modify(@AuthenticationPrincipal Long userId, @PathVariable Long tripId,
                               @Valid @RequestBody MessageRequest r) {
        return planning.handle(userId, tripId, r.message());
    }
}
