package com.naavi.repository;

import com.naavi.entity.Trip;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, Long> {
    /** All trip access goes through the owner id, so one user can never load another user's trip. */
    Optional<Trip> findByIdAndUserId(Long id, Long userId);

    List<Trip> findByUserIdOrderByUpdatedAtDesc(Long userId);
}
