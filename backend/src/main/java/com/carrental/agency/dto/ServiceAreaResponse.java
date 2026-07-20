package com.carrental.agency.dto;

import java.util.List;

/**
 * The agency's operating area. {@code polygons} carries the actual geometry
 * (one outer ring per part — the area may be scattered); {@code mode} +
 * {@code cities}/{@code radiusKm} echo how it was defined (CITIES or CUSTOM)
 * so the console re-renders the picker as the agency left it. Everything is
 * null/empty when no area is set yet.
 */
public record ServiceAreaResponse(
        String mode,
        Integer radiusKm,
        List<CityArea> cities,
        List<List<LatLng>> polygons
) {
    public static ServiceAreaResponse empty() {
        return new ServiceAreaResponse(null, null, List.of(), List.of());
    }
}
