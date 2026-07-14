package com.carrental.search;

import java.math.BigDecimal;

/**
 * One agency in the trip-first search: what a customer chooses between (the
 * marketplace's "ride option"). {@code fromPricePerDay} is the cheapest
 * available car; rating aggregates every review across the agency's fleet.
 */
public record AgencySearchResult(
        Long agencyId,
        String name,
        String city,
        Double latitude,
        Double longitude,
        long availableCars,
        BigDecimal fromPricePerDay,
        Double averageRating,
        long reviewCount
) {
}
