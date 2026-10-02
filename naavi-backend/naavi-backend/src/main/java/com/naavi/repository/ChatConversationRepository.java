package com.naavi.repository;

import com.naavi.entity.ChatConversation;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {
    Optional<ChatConversation> findByTripId(Long tripId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ChatConversation c where c.tripId = :tripId")
    void deleteByTripId(@Param("tripId") Long tripId);
}
