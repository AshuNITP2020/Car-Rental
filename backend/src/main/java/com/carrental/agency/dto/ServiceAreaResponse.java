package com.carrental.agency.dto;

import java.util.List;

/** The agency's operating polygon; {@code polygon} is null when not drawn yet. */
public record ServiceAreaResponse(List<LatLng> polygon) {
}
