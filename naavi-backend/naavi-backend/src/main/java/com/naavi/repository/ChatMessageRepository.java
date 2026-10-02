package com.naavi.repository;

import com.naavi.entity.ChatMessage;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByConversationIdOrderByIdAsc(Long conversationId);

    List<ChatMessage> findByConversationIdOrderByIdDesc(Long conversationId, Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ChatMessage m where m.conversationId in "
            + "(select c.id from ChatConversation c where c.tripId = :tripId)")
    void deleteByTripId(@Param("tripId") Long tripId);
}
