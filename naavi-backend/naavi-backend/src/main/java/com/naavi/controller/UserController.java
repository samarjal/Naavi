package com.naavi.controller;

import com.naavi.dto.Dto.*;
import com.naavi.service.Mapper;
import com.naavi.service.PreferenceService;
import com.naavi.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserController {
    private final UserService users;
    private final PreferenceService preferences;

    @GetMapping
    public UserDto me(@AuthenticationPrincipal Long userId) {
        return Mapper.user(users.get(userId));
    }

    @PutMapping
    public UserDto update(@AuthenticationPrincipal Long userId, @Valid @RequestBody UpdateUserRequest r) {
        return Mapper.user(users.update(userId, r));
    }

    @GetMapping("/preferences")
    public PreferenceDto getPreferences(@AuthenticationPrincipal Long userId) {
        return Mapper.pref(preferences.get(userId));
    }

    /** Onboarding: first-time save of the five core preferences. */
    @PostMapping("/preferences")
    public ResponseEntity<PreferenceDto> createPreferences(@AuthenticationPrincipal Long userId,
                                                           @Valid @RequestBody PreferenceRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Mapper.pref(preferences.create(userId, r)));
    }

    /** Profile/Settings: partial update (null fields unchanged). */
    @PutMapping("/preferences")
    public PreferenceDto updatePreferences(@AuthenticationPrincipal Long userId,
                                           @Valid @RequestBody PreferenceRequest r) {
        return Mapper.pref(preferences.update(userId, r));
    }
}
