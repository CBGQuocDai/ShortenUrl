package com.backend.shortenUrl.entity;


import com.backend.auth.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
public class ShortenUrl {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String shortCode;
    private String url;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long accessCount;
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
}
