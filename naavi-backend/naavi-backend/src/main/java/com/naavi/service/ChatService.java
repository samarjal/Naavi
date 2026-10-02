package com.naavi.service;

import com.naavi.entity.ChatConversation;
import com.naavi.entity.ChatMessage;
import com.naavi.model.MessageRole;
import com.naavi.repository.ChatConversationRepository;
import com.naavi.repository.ChatMessageRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;

    @Transactional
    public ChatConversation getOrCreate(Long tripId) {
        return conversations.findByTripId(tripId).orElseGet(() -> {
            ChatConversation c = new ChatConversation();
            c.setTripId(tripId);
            return conversations.save(c);
        });
    }

    @Transactional
    public ChatMessage add(Long conversationId, MessageRole role, String content) {
        ChatMessage m = new ChatMessage();
        m.setConversationId(conversationId);
        m.setRole(role);
        m.setContent(content);
        return messages.save(m);
    }

    /** Last {@code n} messages, oldest first. */
    @Transactional(readOnly = true)
    public List<ChatMessage> recent(Long conversationId, int n) {
        List<ChatMessage> latest = new ArrayList<>(
                messages.findByConversationIdOrderByIdDesc(conversationId, PageRequest.of(0, n)));
        Collections.reverse(latest);
        return latest;
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> history(Long tripId) {
        return conversations.findByTripId(tripId)
                .map(c -> messages.findByConversationIdOrderByIdAsc(c.getId()))
                .orElse(List.of());
    }
}
