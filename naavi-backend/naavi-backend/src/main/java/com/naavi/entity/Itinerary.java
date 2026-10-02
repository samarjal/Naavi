package com.naavi.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One generated version of a trip's plan. The full structured result (days, transport, stays,
 * weather, expenses, alternatives) is stored as JSON; Expense rows are stored separately so they
 * can be queried/aggregated.
 */
@Entity
@Table(name = "itineraries",
        uniqueConstraints = @UniqueConstraint(name = "uk_itin_trip_version", columnNames = {"tripId", "version"}))
@Getter
@Setter
@NoArgsConstructor
public class Itinerary extends BaseEntity {
    @Column(nullable = false)
    private Long tripId;

    @Column(nullable = false)
    private int version;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String planJson;

    @Column(precision = 12, scale = 2)
    private BigDecimal userBudget;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalEstimatedCost;
}
