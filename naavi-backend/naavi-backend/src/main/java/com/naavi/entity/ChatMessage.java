package com.naavi.entity;

import com.naavi.model.MessageRole;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_messages", indexes = @Index(name = "idx_msg_conv", columnList = "conversationId"))
@Getter
@Setter
@NoArgsConstructor
public class ChatMessage extends BaseEntity {
    @Column(nullable = false)
    private Long conversationId;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private MessageRole role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
}
