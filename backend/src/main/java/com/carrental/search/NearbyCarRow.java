package com.carrental.search;

import java.math.BigDecimal;

/**
 * Spring Data projection for the native proximity query. The query aliases each
 * column to exactly these property names (double-quoted so Postgres keeps the
 * camelCase), and Spring binds them to these getters. Carries the same fields as
 * {@link CarSearchResult} plus the computed {@code distanceKm} from the search
 * origin. (Task #33)
 */
public interface NearbyCarRow {
    Long getId();
    Long getAgencyId();
    String getAgencyName();
    String getCity();
    String getMake();
    String getModel();
    String getCategory();
    BigDecimal getPricePerDay();
    Double getLatitude();
    Double getLongitude();
    String getStatus();
    double getDistanceKm();
}
