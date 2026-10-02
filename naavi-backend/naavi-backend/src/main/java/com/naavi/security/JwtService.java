package com.naavi.security;

import com.naavi.config.AppProperties;
import com.naavi.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final SecretKey key;
    private final long expirationMinutes;
    /** jti -> expiry. In-memory: fine for one instance; use Redis/DB if you scale horizontally. */
    private final Map<String, Date> revoked = new ConcurrentHashMap<>();

    public JwtService(AppProperties props) {
        String secret = props.jwt().secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set and be at least 32 characters long");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMinutes = props.jwt().expirationMinutes();
    }

    public String generate(User user) {
        Date now = new Date();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMinutes * 60_000))
                .signWith(key)
                .compact();
    }

    /** Throws JwtException if the token is malformed, expired or has a bad signature. */
    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public boolean isRevoked(Claims claims) {
        return revoked.containsKey(claims.getId());
    }

    public void revoke(String token) {
        Claims c = parse(token);
        Date now = new Date();
        revoked.entrySet().removeIf(e -> e.getValue().before(now));
        revoked.put(c.getId(), c.getExpiration());
    }

    public long expiresInSeconds() {
        return expirationMinutes * 60;
    }
}
