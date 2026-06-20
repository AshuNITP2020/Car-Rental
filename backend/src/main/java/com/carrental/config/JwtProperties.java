package com.carrental.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Strongly-typed binding for the {@code app.jwt.*} settings. */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        String secret,
        long accessMinutes,
        long refreshDays
) {
}
