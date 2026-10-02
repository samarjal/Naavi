package com.naavi.entity;

import com.naavi.model.TripStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "trips", indexes = @Index(name = "idx_trip_user", columnList = "userId"))
@Getter
@Setter
@NoArgsConstructor
public class Trip extends BaseEntity {
    @Column(nullable = false)
    private Long userId;

    @Column(length = 200)
    private String title;

    @Column(length = 120) private String source;
    @Column(length = 120) private String destination;

    @Column(precision = 12, scale = 2)
    private BigDecimal budget;

    private Integer travelers;
    private Integer days;
    private LocalDate startDate;
    private LocalDate endDate;

    @Column(length = 2000)
    private String specialRequirements;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TripStatus status = TripStatus.DRAFT;
}
