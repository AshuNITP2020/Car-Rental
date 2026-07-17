package com.carrental.pricing;

import com.carrental.agency.ServiceAreaService;
import com.carrental.city.CityService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

/**
 * Resolves the one-way relocation fee between the car's location and the
 * customer's drop pin (great-circle distance × ₹/km). Shared by the quote
 * endpoint and booking creation so the customer is always quoted exactly what
 * the booking will charge. The drop pin must fall inside SOME agency's
 * operating area — we don't strand cars where nobody operates.
 */
@Service
public class OneWayFeeService {

    /** Below this the "one-way" is a rounding error — use a round trip. */
    private static final double MIN_DISTANCE_KM = 1.0;

    private final PricingService pricing;
    private final ServiceAreaService serviceAreas;

    public OneWayFeeService(PricingService pricing, ServiceAreaService serviceAreas) {
        this.pricing = pricing;
        this.serviceAreas = serviceAreas;
    }

    /** Fee for relocating a car at (originLat,originLng) to the drop pin. */
    public BigDecimal feeFor(Double originLat, Double originLng, Double dropLat, Double dropLng) {
        if (dropLat == null || dropLng == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "'dropLat' and 'dropLng' are required for a one-way trip");
        }
        if (dropLat < -90 || dropLat > 90 || dropLng < -180 || dropLng > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Drop coordinates out of range");
        }
        if (originLat == null || originLng == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This car has no location configured — one-way is unavailable");
        }
        if (!serviceAreas.isCovered(dropLat, dropLng)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "We don't operate at that drop-off point yet");
        }
        double km = CityService.haversineKm(originLat, originLng, dropLat, dropLng);
        if (km < MIN_DISTANCE_KM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The drop point is essentially the pickup point — use a round trip instead");
        }
        return pricing.oneWayFeeFor(km);
    }
}
