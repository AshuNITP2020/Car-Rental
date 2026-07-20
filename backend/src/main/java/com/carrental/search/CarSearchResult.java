package com.carrental.search;

import com.carrental.agency.Agency;
import com.carrental.car.Car;

import java.math.BigDecimal;

/**
 * One car in a customer-facing search result. Richer than the agency-side
 * {@code CarResponse}: it carries the owning agency's name + city (and the car's
 * coordinates) so a customer can see where the car is without a second call, and
 * the aggregate review rating ({@code averageRating} null / {@code reviewCount} 0
 * when unreviewed — filled in by the service via one bulk query per page).
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
        Integer seats,
        BigDecimal pricePerDay,
        Double latitude,
        Double longitude,
        String status,
        Double averageRating,
        long reviewCount
) {
    public static CarSearchResult from(Car car) {
        Agency a = car.getAgency();
        return new CarSearchResult(
                car.getId(),
                a.getId(),
                a.getName(),
                // where the car actually is (a one-way trip may have moved it)
                car.getCurrentCity() != null ? car.getCurrentCity() : a.getCity(),
                car.getMake(),
                car.getModel(),
                car.getCategory(),
                car.getSeats(),
                car.getPricePerDay(),
                car.getLatitude(),
                car.getLongitude(),
                car.getStatus().name(),
                null,
                0);
    }

    /** Copy with the aggregate rating filled in (records are immutable). */
    public CarSearchResult withRating(Double averageRating, long reviewCount) {
        return new CarSearchResult(id, agencyId, agencyName, city, make, model, category,
                seats, pricePerDay, latitude, longitude, status, averageRating, reviewCount);
    }
}
