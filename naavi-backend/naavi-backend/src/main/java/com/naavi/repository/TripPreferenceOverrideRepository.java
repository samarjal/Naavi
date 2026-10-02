package com.naavi.repository;

import com.naavi.entity.TripPreferenceOverride;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TripPreferenceOverrideRepository extends JpaRepository<TripPreferenceOverride, Long> {
    Optional<TripPreferenceOverride> findByTripId(Long tripId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from TripPreferenceOverride o where o.tripId = :tripId")
    void deleteByTripId(@Param("tripId") Long tripId);
}
