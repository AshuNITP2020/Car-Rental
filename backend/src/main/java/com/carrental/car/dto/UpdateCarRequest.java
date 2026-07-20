package com.carrental.car.dto;

import com.carrental.car.CarStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Full representation for PUT. Invalid status values are rejected as 400. */
public record UpdateCarRequest(
        @NotBlank @Size(max = 60) String make,
        @NotBlank @Size(max = 60) String model,
        @NotBlank @Size(max = 40) String category,
        @Min(1) @Max(12) Integer seats,
        @NotBlank @Size(max = 20) String regNo,
        @NotNull @PositiveOrZero BigDecimal pricePerDay,
        @NotNull CarStatus status,
        Double latitude,
        Double longitude
) {
    public int seatsOrDefault() {
        return seats != null ? seats : 5;
    }
}
