package com.carrental.car;

import java.math.BigDecimal;

public record CarResponse(
        Long id,
        Long agencyId,
        String make,
        String model,
        String category,
        String regNo,
        BigDecimal pricePerDay,
        String status,
        Double latitude,
        Double longitude,
        String currentCity
) {
    public static CarResponse from(Car car) {
        return new CarResponse(
                car.getId(),
                car.getAgency().getId(),
                car.getMake(),
                car.getModel(),
                car.getCategory(),
                car.getRegNo(),
                car.getPricePerDay(),
                car.getStatus().name(),
                car.getLatitude(),
                car.getLongitude(),
                car.getCurrentCity());
    }
}
