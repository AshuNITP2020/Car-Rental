package com.carrental.agency.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One city an agency serves: a display name and the centroid to buffer around. */
public record CityArea(@NotBlank @Size(max = 120) String name, double lat, double lng) {
}
