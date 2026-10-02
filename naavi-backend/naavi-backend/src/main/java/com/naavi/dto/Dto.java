package com.naavi.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import com.naavi.model.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** All request/response shapes in one place. */
public final class Dto {
    private Dto() {}

    // ---- auth ----
    public record SignupRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 72, message = "Password must be 8-72 characters") String password,
            @Size(max = 20) String phone,
            @Size(max = 500) String profilePictureUrl) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record AuthResponse(String token, String tokenType, long expiresInSeconds, UserDto user) {}

    // ---- user ----
    public record UserDto(Long id, String name, String email, String phone, String profilePictureUrl,
                          boolean onboardingCompleted, Instant createdAt) {}

    public record UpdateUserRequest(@Size(max = 100) String name, @Size(max = 20) String phone,
                                    @Size(max = 500) String profilePictureUrl) {}

    // ---- preferences (all fields nullable on requests: null = leave unchanged on PUT) ----
    public record PreferenceRequest(
            FoodPreference foodPreference,
            LocalTravelPreference localTravelPreference,
            AccommodationPreference accommodationPreference,
            TravelStyle travelStyle,
            TransportationPreference transportationPreference,
            @Size(max = 500) String dietaryNotes,
            @Size(max = 500) String preferredActivities,
            @Size(max = 200) String walkingTolerance,
            @Size(max = 500) String accessibilityRequirements,
            @Size(max = 200) String preferredAccommodationArea,
            @Size(max = 100) String tripPace) {}

    public record PreferenceDto(
            FoodPreference foodPreference,
            LocalTravelPreference localTravelPreference,
            AccommodationPreference accommodationPreference,
            TravelStyle travelStyle,
            TransportationPreference transportationPreference,
            String dietaryNotes, String preferredActivities, String walkingTolerance,
            String accessibilityRequirements, String preferredAccommodationArea, String tripPace,
            Instant updatedAt) {}

    public record OverridesDto(
            FoodPreference foodPreference,
            LocalTravelPreference localTravelPreference,
            AccommodationPreference accommodationPreference,
            TravelStyle travelStyle,
            TransportationPreference transportationPreference,
            @Size(max = 1000) String notes) {

        @JsonIgnore
        public boolean isEmpty() {
            return foodPreference == null && localTravelPreference == null && accommodationPreference == null
                    && travelStyle == null && transportationPreference == null && (notes == null || notes.isBlank());
        }
    }

    // ---- trips ----
    public record TripRequest(
            @Size(max = 120) String source,
            @Size(max = 120) String destination,
            @DecimalMin(value = "1", message = "Budget must be positive") @DecimalMax("100000000") BigDecimal budget,
            @Min(1) @Max(50) Integer travelers,
            @Min(1) @Max(30) Integer days,
            LocalDate startDate,
            LocalDate endDate,
            @Size(max = 2000) String specialRequirements,
            @Valid OverridesDto overrides) {}

    public record TripDto(Long id, String title, String source, String destination, BigDecimal budget,
                          Integer travelers, Integer days, LocalDate startDate, LocalDate endDate,
                          String specialRequirements, TripStatus status, OverridesDto overrides,
                          Instant createdAt, Instant updatedAt) {}

    public record TripDetailDto(TripDto trip, Integer itineraryVersion, JsonNode itinerary) {}

    // ---- AI / chat ----
    public record PlanRequest(@NotBlank @Size(max = 2000) String message, Long tripId) {}

    public record MessageRequest(@NotBlank @Size(max = 2000) String message) {}

    public record ChatMessageDto(Long id, String role, String content, Instant createdAt) {}

    /** type = QUESTION (backend needs more info) | ITINERARY (plan generated/updated) | MESSAGE (plain reply). */
    public record ChatResponse(String type, String reply, TripDto trip, JsonNode itinerary,
                               List<String> missingFields) {}
}
