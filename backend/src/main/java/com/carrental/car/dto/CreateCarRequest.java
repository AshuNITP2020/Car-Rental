package com.carrental.car.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateCarRequest(
        @NotBlank @Size(max = 60) String make,
        @NotBlank @Size(max = 60) String model,
        @NotBlank @Size(max = 40) String category,
        @NotBlank @Size(max = 20) String regNo,
        @NotNull @PositiveOrZero BigDecimal pricePerDay,
        Double latitude,
        Double longitude
) {
}
