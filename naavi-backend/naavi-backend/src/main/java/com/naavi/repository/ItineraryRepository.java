package com.naavi.repository;

import com.naavi.entity.Itinerary;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItineraryRepository extends JpaRepository<Itinerary, Long> {
    Optional<Itinerary> findTopByTripIdOrderByVersionDesc(Long tripId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Itinerary i where i.tripId = :tripId")
    void deleteByTripId(@Param("tripId") Long tripId);
}
