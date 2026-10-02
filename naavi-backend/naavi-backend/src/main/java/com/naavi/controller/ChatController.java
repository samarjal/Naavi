package com.naavi.controller;

import com.naavi.dto.Dto.*;
import com.naavi.service.ChatService;
import com.naavi.service.Mapper;
import com.naavi.service.TravelPlanningService;
import com.naavi.service.TripService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trips/{tripId}/chat")
@RequiredArgsConstructor
public class ChatController {
    private final TravelPlanningService planning;
    private final TripService trips;
    private final ChatService chat;

    @PostMapping
    public ChatResponse send(@AuthenticationPrincipal Long userId, @PathVariable Long tripId,
                             @Valid @RequestBody MessageRequest r) {
        return planning.handle(userId, tripId, r.message());
    }

    @GetMapping
    public List<ChatMessageDto> history(@AuthenticationPrincipal Long userId, @PathVariable Long tripId) {
        trips.getOwned(userId, tripId); // ownership check (404 if not yours)
        return chat.history(tripId).stream().map(Mapper::message).toList();
    }
}
