package com.carrental.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Rate-limit settings. A fixed one-minute window allows
 * {@code requestsPerMinute} requests per client (authenticated user id, else
 * remote IP). Turn off entirely with {@code app.rate-limit.enabled=false}.
 */
@ConfigurationProperties(prefix = "app.rate-limit")
public record RateLimitProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("120") int requestsPerMinute
) {
}
