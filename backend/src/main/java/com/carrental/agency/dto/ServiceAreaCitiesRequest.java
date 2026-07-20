package com.carrental.agency.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;

import java.util.List;

/**
 * Cities-mode area definition: a circle of {@code radiusKm} around each picked
 * city. The resulting zone may be SCATTERED — disjoint circles are fine, they
 * just mean "we operate here and there, not in between".
 */
public record ServiceAreaCitiesRequest(
        @NotEmpty @Size(max = 25) List<@Valid CityArea> cities,
        @Min(5) @Max(100) int radiusKm
) {
}
