package com.carrental.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Task #35: the Redis-backed fixed-window rate limiter, against the real (dev)
 * Redis. Each test uses a unique client IP so its window counter is isolated from
 * other tests/runs (and the 60s TTL cleans the keys up).
 */
@SpringBootTest
class RateLimitFilterTest {

    @Autowired StringRedisTemplate redis;

    @Test
    void allowsUpToLimitThenBlocksWith429() throws Exception {
        int limit = 3;
        RateLimitFilter filter = new RateLimitFilter(redis, true, limit);
        String ip = "rl-" + UUID.randomUUID();

        for (int i = 1; i <= limit; i++) {
            MockFilterChain chain = new MockFilterChain();
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(request(ip), res, chain);
            assertNotNull(chain.getRequest(), "request " + i + " should pass through");
            assertEquals(HttpStatus.OK.value(), res.getStatus());
        }

        // One over the limit -> blocked, chain not invoked.
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(request(ip), res, chain);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(), res.getStatus());
        assertNull(chain.getRequest(), "over-limit request must not reach the chain");
        assertNotNull(res.getHeader("Retry-After"), "429 should carry Retry-After");
    }

    @Test
    void disabled_neverBlocks() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(redis, false, 1);
        String ip = "rl-" + UUID.randomUUID();
        for (int i = 0; i < 5; i++) {   // well past the limit of 1
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request(ip), new MockHttpServletResponse(), chain);
            assertNotNull(chain.getRequest(), "disabled limiter must pass every request");
        }
    }

    private MockHttpServletRequest request(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/cars/search");
        req.setRemoteAddr(ip);
        return req;
    }
}
