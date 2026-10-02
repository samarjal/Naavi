package com.naavi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_conversations", uniqueConstraints = @UniqueConstraint(name = "uk_conv_trip", columnNames = "tripId"))
@Getter
@Setter
@NoArgsConstructor
public class ChatConversation extends BaseEntity {
    @Column(nullable = false)
    private Long tripId;
}
