package com.naavi.repository;

import com.naavi.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Expense e where e.itineraryId in (select i.id from Itinerary i where i.tripId = :tripId)")
    void deleteByTripId(@Param("tripId") Long tripId);
}
