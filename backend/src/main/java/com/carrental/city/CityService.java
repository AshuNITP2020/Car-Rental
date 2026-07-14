package com.carrental.city;

import com.carrental.agency.AgencyRepository;
import com.carrental.city.dto.CityInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * The marketplace's operating cities (derived from agency data — no external
 * geocoding). Powers the pickup/destination autocomplete, route-distance
 * estimates, and the one-way relocation fee.
 */
@Service
public class CityService {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private final AgencyRepository agencies;

    public CityService(AgencyRepository agencies) {
        this.agencies = agencies;
    }

    @Transactional(readOnly = true)
    public List<CityInfo> operatingCities() {
        return agencies.operatingCities().stream()
                .map(r -> new CityInfo(r.getCity(), r.getAgencyCount(), r.getLatitude(), r.getLongitude()))
                .toList();
    }

    /** Case-insensitive lookup of a known operating city. */
    @Transactional(readOnly = true)
    public Optional<CityInfo> find(String city) {
        if (city == null || city.isBlank()) {
            return Optional.empty();
        }
        String needle = city.trim().toLowerCase(Locale.ROOT);
        return operatingCities().stream()
                .filter(c -> c.city().toLowerCase(Locale.ROOT).equals(needle))
                .findFirst();
    }

    /**
     * Great-circle distance between two known cities' centroids, in km.
     * Empty when either city is unknown or has no coordinates.
     */
    @Transactional(readOnly = true)
    public Optional<Double> distanceKm(String cityA, String cityB) {
        Optional<CityInfo> a = find(cityA);
        Optional<CityInfo> b = find(cityB);
        if (a.isEmpty() || b.isEmpty()
                || a.get().latitude() == null || a.get().longitude() == null
                || b.get().latitude() == null || b.get().longitude() == null) {
            return Optional.empty();
        }
        return Optional.of(haversineKm(
                a.get().latitude(), a.get().longitude(),
                b.get().latitude(), b.get().longitude()));
    }

    /** Standard haversine great-circle distance. */
    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
    }
}
