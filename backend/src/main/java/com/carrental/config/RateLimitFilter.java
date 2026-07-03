package com.carrental.config;

import com.carrental.auth.AuthPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

/**
 * Fixed-window rate limiter (Task #35), backed by Redis so the limit holds across
 * instances. Per client — the authenticated user id if present, else the remote
 * IP — at most {@code requestsPerMinute} requests per 60s window. On a breach it
 * returns 429 with a {@code Retry-After} header and does not invoke the rest of
 * the chain.
 *
 * <p>Added to the security chain AFTER {@code JwtAuthenticationFilter} so the
 * principal is already resolved. Fixed-window is the simplest correct approach (a
 * client can burst across a window boundary — acceptable here; a sliding window or
 * token bucket would tighten that). It deliberately fails OPEN: if Redis is
 * unreachable the request is allowed through, so the limiter can never itself take
 * the API down.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final long WINDOW_SECONDS = 60;

    private final StringRedisTemplate redis;
    private final boolean enabled;
    private final int limit;

    public RateLimitFilter(StringRedisTemplate redis, boolean enabled, int requestsPerMinute) {
        this.redis = redis;
        this.enabled = enabled;
        this.limit = requestsPerMinute;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        if (!enabled) {
            return true;
        }
        String path = request.getRequestURI();

        return !path.startsWith("/api/")
                || path.startsWith("/api/payments/webhook")
                || path.equals("/api/health");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        long now = Instant.now().getEpochSecond();
        String key = "ratelimit:" + clientId(request) + ":" + (now / WINDOW_SECONDS);

        Long count;
        try {
            count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redis.expire(key, Duration.ofSeconds(WINDOW_SECONDS));
            }
        } catch (RuntimeException e) {
            log.warn("Rate limiter unavailable, allowing request: {}", e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        if (count != null && count > limit) {
            long retryAfter = WINDOW_SECONDS - (now % WINDOW_SECONDS);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.getWriter().write(
                    "{\"status\":429,\"error\":\"Too Many Requests\","
                            + "\"message\":\"Rate limit exceeded; retry in " + retryAfter + "s\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static String clientId(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal principal) {
            return "u:" + principal.userId();
        }
        return "ip:" + request.getRemoteAddr();
    }
}
