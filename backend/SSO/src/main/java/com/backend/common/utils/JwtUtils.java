package com.backend.common.utils;

import com.backend.common.utils.properties.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Component
public class JwtUtils {

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtUtils(JwtProperties properties) {
        this.properties = properties;
        byte[] secretBytes = properties.getSecret().getBytes();
        if (secretBytes.length < 32) {
            throw new IllegalStateException("jwt.secret must be at least 32 bytes (256 bits) for HS256");
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
    }

    public String generateToken(String username) {
        Instant now = Instant.now();
        return Jwts.builder()
                .signWith(key)
                .issuer(properties.getIssuer())
                .subject(username)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.getDuration(), ChronoUnit.SECONDS)))
                .compact();
    }

    @Cacheable(value = "jwt",key = "#token")
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
