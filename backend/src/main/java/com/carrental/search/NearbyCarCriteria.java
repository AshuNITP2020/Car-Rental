package com.carrental.search;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Normalized, validated inputs for a "cars near me" proximity search. The
 * controller turns raw query params into this (blank strings -> null, lat/lng/
 * radius bounds checked); the service turns it into the native PostGIS query.
 * {@code lat}/{@code lng} are the search origin and {@code radiusKm} the cutoff;
 * the remaining filters mirror {@link CarSearchCriteria}. Results are always
 * ordered by distance from the origin, so there is no {@code sort}. (Task #33)
 */
public record NearbyCarCriteria(
        double lat,
        double lng,
        double radiusKm,
        String category,
        String keyword,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        OffsetDateTime from,
        OffsetDateTime to,
        int page,
        int size
) {
}
