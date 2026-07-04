package com.carrental.search;

import com.carrental.agency.Agency;
import com.carrental.car.Car;

import java.math.BigDecimal;

/**
 * One car in a customer-facing search result. Richer than the agency-side
 * {@code CarResponse}: it carries the owning agency's name + city (and the car's
 * coordinates) so a customer can see where the car is without a second call.
 * Built from a car whose agency is already fetched (see {@code CarSearchRepository}),
 * so {@code from} triggers no extra query.
 */
public record CarSearchResult(
        Long id,
        Long agencyId,
        String agencyName,
        String city,
        String make,
        String model,
        String category,
        BigDecimal pricePerDay,
        Double latitude,
        Double longitude,
        String status
) {
    public static CarSearchResult from(Car car) {
        Agency a = car.getAgency();
        return new CarSearchResult(
                car.getId(),
                a.getId(),
                a.getName(),
                a.getCity(),
                car.getMake(),
                car.getModel(),
                car.getCategory(),
                car.getPricePerDay(),
                car.getLatitude(),
                car.getLongitude(),
                car.getStatus().name());
    }
}
