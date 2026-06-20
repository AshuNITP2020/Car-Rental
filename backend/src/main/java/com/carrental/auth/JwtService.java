package com.carrental.auth;

import com.carrental.config.JwtProperties;
import com.carrental.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

/**
 * Issues and verifies signed JWTs.
 *  - access token:  short-lived, sent on every request
 *  - refresh token: long-lived, exchanged for a new access token
 * The {@code type} claim distinguishes them so a refresh token can't be used
 * as an access token (or vice-versa).
 */
@Service
public class JwtService {

    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final SecretKey key;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtService(JwtProperties props) {
        this.key = Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8));
        this.accessTtl = Duration.ofMinutes(props.accessMinutes());
        this.refreshTtl = Duration.ofDays(props.refreshDays());
    }

    public String generateAccessToken(User user) {
        return build(user, TYPE_ACCESS, accessTtl);
    }

    public String generateRefreshToken(User user) {
        return build(user, TYPE_REFRESH, refreshTtl);
    }

    public long accessTtlSeconds() {
        return accessTtl.toSeconds();
    }

    private String build(User user, String type, Duration ttl) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("type", type)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** Parses and verifies the signature/expiry; throws if invalid. */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long userId(Claims claims) {
        return Long.valueOf(claims.getSubject());
    }

    public String tokenType(Claims claims) {
        return claims.get("type", String.class);
    }
}
