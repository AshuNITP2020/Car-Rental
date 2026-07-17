package com.carrental.city;

import com.carrental.agency.AgencyRepository;
import com.carrental.city.dto.CityInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

    /**
     * The operating city nearest to a map point — used as the human-readable
     * label for free-form pickup/drop pins ("~4 km from Mumbai").
     */
    @Transactional(readOnly = true)
    public Optional<CityInfo> nearestTo(double lat, double lng) {
        return operatingCities().stream()
                .filter(c -> c.latitude() != null && c.longitude() != null)
                .min(java.util.Comparator.comparingDouble(
                        c -> haversineKm(lat, lng, c.latitude(), c.longitude())));
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
