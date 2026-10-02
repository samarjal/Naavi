package com.naavi.entity;

import com.naavi.model.*;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "trip_preference_overrides", uniqueConstraints = @UniqueConstraint(name = "uk_override_trip", columnNames = "tripId"))
@Getter
@Setter
@NoArgsConstructor
public class TripPreferenceOverride extends BaseEntity {
    @Column(nullable = false)
    private Long tripId;

    @Enumerated(EnumType.STRING) @Column(length = 30) private FoodPreference foodPreference;
    @Enumerated(EnumType.STRING) @Column(length = 30) private LocalTravelPreference localTravelPreference;
    @Enumerated(EnumType.STRING) @Column(length = 30) private AccommodationPreference accommodationPreference;
    @Enumerated(EnumType.STRING) @Column(length = 30) private TravelStyle travelStyle;
    @Enumerated(EnumType.STRING) @Column(length = 30) private TransportationPreference transportationPreference;

    @Column(length = 1000)
    private String notes;
}
