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

    /**
     * Access token carries the tenant context too: which agency the user acts
     * for (agencyId) and their role within it (agencyRole). Both may be null
     * for a user who belongs to no agency (e.g. a plain customer).
     */
    public String generateAccessToken(User user, Long agencyId, String agencyRole) {
        return build(user, TYPE_ACCESS, accessTtl, agencyId, agencyRole);
    }

    public String generateRefreshToken(User user) {
        return build(user, TYPE_REFRESH, refreshTtl, null, null);
    }

    public long accessTtlSeconds() {
        return accessTtl.toSeconds();
    }

    private String build(User user, String type, Duration ttl, Long agencyId, String agencyRole) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .claim("type", type)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)));
        if (agencyId != null) {
            builder.claim("agencyId", agencyId);
        }
        if (agencyRole != null) {
            builder.claim("agencyRole", agencyRole);
        }
        return builder.signWith(key).compact();
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

    public String role(Claims claims) {
        return claims.get("role", String.class);
    }

    public Long agencyId(Claims claims) {
        Number n = claims.get("agencyId", Number.class);
        return n == null ? null : n.longValue();
    }

    public String agencyRole(Claims claims) {
        return claims.get("agencyRole", String.class);
    }
}
