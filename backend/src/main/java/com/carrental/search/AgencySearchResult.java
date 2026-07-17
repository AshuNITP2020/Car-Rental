package com.carrental.search;

import com.carrental.agency.dto.LatLng;

import java.math.BigDecimal;
import java.util.List;

/**
 * One agency in the trip-first search: what a customer chooses between (the
 * marketplace's "ride option"). Matched because its operating polygon covers
 * the customer's pickup pin. {@code serviceArea} is the polygon ring so the
 * map can show WHY it matched; {@code distanceKm} is agency base -> pickup pin.
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
        long reviewCount,
        Double distanceKm,
        List<LatLng> serviceArea
) {
}
