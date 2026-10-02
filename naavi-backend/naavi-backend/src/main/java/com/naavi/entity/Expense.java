package com.naavi.entity;

import com.naavi.model.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "expenses", indexes = @Index(name = "idx_expense_itinerary", columnList = "itineraryId"))
@Getter
@Setter
@NoArgsConstructor
public class Expense extends BaseEntity {
    @Column(nullable = false)
    private Long itineraryId;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private PlanType planType;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30)
    private ExpenseCategory category;

    @Column(length = 255)
    private String description;

    @Column(precision = 14, scale = 2) private BigDecimal unitCost;
    @Column(precision = 14, scale = 2) private BigDecimal quantity;
    @Column(precision = 14, scale = 2) private BigDecimal amount;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private DataType dataType;
}
