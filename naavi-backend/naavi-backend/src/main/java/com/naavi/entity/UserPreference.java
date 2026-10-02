package com.naavi.entity;

import com.naavi.model.*;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_preferences", uniqueConstraints = @UniqueConstraint(name = "uk_pref_user", columnNames = "userId"))
@Getter
@Setter
@NoArgsConstructor
public class UserPreference extends BaseEntity {
    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING) @Column(length = 30)
    private FoodPreference foodPreference;

    @Enumerated(EnumType.STRING) @Column(length = 30)
    private LocalTravelPreference localTravelPreference;

    @Enumerated(EnumType.STRING) @Column(length = 30)
    private AccommodationPreference accommodationPreference;

    @Enumerated(EnumType.STRING) @Column(length = 30)
    private TravelStyle travelStyle;

    @Enumerated(EnumType.STRING) @Column(length = 30)
    private TransportationPreference transportationPreference;

    // Optional long-term extras
    @Column(length = 500) private String dietaryNotes;
    @Column(length = 500) private String preferredActivities;
    @Column(length = 200) private String walkingTolerance;
    @Column(length = 500) private String accessibilityRequirements;
    @Column(length = 200) private String preferredAccommodationArea;
    @Column(length = 100) private String tripPace;
}
