package com.carrental.agency.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** The agency's operating polygon as drawn on the map (outer ring, unclosed). */
public record ServiceAreaRequest(@NotEmpty List<LatLng> polygon) {
}
