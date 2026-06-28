package com.carrental.search;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Normalized, validated inputs for a car search. The controller turns raw query
 * params into this (blank strings -> null, bounds checked); the service turns it
 * into a query. {@code from}/{@code to} are either both set (availability filter)
 * or both null. (Task #32)
 */
public record CarSearchCriteria(
        String city,
        String category,
        String q,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        OffsetDateTime from,
        OffsetDateTime to,
        String sort,
        int page,
        int size
) {
}
