package com.carrental.pricing;

import com.carrental.city.CityService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

/**
 * Resolves the one-way relocation fee between a car's pickup city and the
 * requested drop city. Shared by the quote endpoint and booking creation so
 * the customer is always quoted exactly what the booking will charge.
 */
@Service
public class OneWayFeeService {

    private final CityService cities;
    private final PricingService pricing;

    public OneWayFeeService(CityService cities, PricingService pricing) {
        this.cities = cities;
        this.pricing = pricing;
    }

    /** Fee for dropping in {@code dropCity} a car picked up in {@code originCity}. */
    public BigDecimal feeFor(String originCity, String dropCity) {
        if (originCity == null || originCity.isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This car has no pickup city configured — one-way is unavailable");
        }
        if (dropCity == null || dropCity.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "'dropCity' is required for a one-way trip");
        }
        if (dropCity.trim().equalsIgnoreCase(originCity.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Drop city must differ from the pickup city — use a round trip instead");
        }
        double km = cities.distanceKm(originCity, dropCity)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "We don't operate in '" + dropCity.trim() + "' yet"));
        return pricing.oneWayFeeFor(km);
    }
}
