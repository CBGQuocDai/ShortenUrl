package com.backend.common.utils;

import com.backend.auth.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Component
public class JwtUtils {
    @Value("${jwt.issuer}")
    private String ISSUER;
    @Value("${jwt.duration}")
    private Long DURATION;
    private final SecretKey key;
    public JwtUtils(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String generateToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder().signWith(key)
                .issuer(ISSUER)
                .subject(user.getUsername())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(DURATION, ChronoUnit.SECONDS)))
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser().verifyWith(this.key).build()
                .parseSignedClaims(token).getPayload();
    }

}
