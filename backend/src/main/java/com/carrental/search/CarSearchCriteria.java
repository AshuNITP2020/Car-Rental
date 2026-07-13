package com.carrental.search;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Normalized, validated inputs for a car search. The controller turns raw query
 * params into this (blank strings -> null, bounds checked); the service turns it
 * into a query. {@code from}/{@code to} are either both set (availability filter)
 * or both null.
 */
public record CarSearchCriteria(
        String city,
        String category,
        String keyword,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        OffsetDateTime from,
        OffsetDateTime to,
        /** Restrict to one agency's fleet (its public profile page). */
        Long agencyId,
        /*price, asc. desc*/
        String sort,
        int page,
        int size
) {
    /**
     * A stable string key over every field that affects the result set — used as
     * the Redis cache key. Two criteria produce the same key iff they
     * would return the same page, so distinct filters never collide.
     */
    public String cacheKey() {
        return String.join("|",
                String.valueOf(city), String.valueOf(category), String.valueOf(keyword),
                String.valueOf(minPrice), String.valueOf(maxPrice),
                String.valueOf(from), String.valueOf(to), String.valueOf(agencyId),
                sort, String.valueOf(page), String.valueOf(size));
    }
}
