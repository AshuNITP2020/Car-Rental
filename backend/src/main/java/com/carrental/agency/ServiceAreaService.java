package com.carrental.agency;

import com.carrental.agency.dto.LatLng;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Agency operating areas: the polygon a customer's pickup pin must fall inside
 * for the agency to appear in trip searches. The polygon travels as an ordered
 * list of lat/lng vertices (unclosed); GeoJSON is built server-side so clients
 * never hand us raw geometry.
 */
@Service
public class ServiceAreaService {

    private static final int MIN_POINTS = 3;
    private static final int MAX_POINTS = 100;

    private final ServiceAreaRepository repo;
    private final AgencyRepository agencies;

    public ServiceAreaService(ServiceAreaRepository repo, AgencyRepository agencies) {
        this.repo = repo;
        this.agencies = agencies;
    }

    @Transactional(readOnly = true)
    public Optional<List<LatLng>> get(Long agencyId) {
        return repo.serviceAreaGeoJson(agencyId).map(ServiceAreaService::ringFromGeoJson);
    }

    @Transactional
    public List<LatLng> update(Long agencyId, List<LatLng> polygon) {
        if (!agencies.existsById(agencyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agency not found");
        }
        String geoJson = toGeoJson(validateRing(polygon));
        if (!repo.isAcceptablePolygon(geoJson)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The area must be a simple (non self-intersecting) polygon of a sensible size");
        }
        repo.updateServiceArea(agencyId, geoJson);
        return polygon;
    }

    /** Is this map point inside ANY live agency's operating area? */
    @Transactional(readOnly = true)
    public boolean isCovered(double lat, double lng) {
        validatePoint(lat, lng);
        return repo.anyAgencyCovers(lat, lng);
    }

    /** Does THIS agency's own zone cover the point? (its cars never leave it) */
    @Transactional(readOnly = true)
    public boolean isCoveredBy(Long agencyId, double lat, double lng) {
        validatePoint(lat, lng);
        return repo.agencyCovers(agencyId, lat, lng);
    }

    /** How many live agencies can run the whole route (zone covers both ends). */
    @Transactional(readOnly = true)
    public long routeCoverage(double pickupLat, double pickupLng, double dropLat, double dropLng) {
        validatePoint(pickupLat, pickupLng);
        validatePoint(dropLat, dropLng);
        return repo.countCoveringRoute(pickupLat, pickupLng, dropLat, dropLng);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static List<LatLng> validateRing(List<LatLng> polygon) {
        if (polygon == null || polygon.size() < MIN_POINTS || polygon.size() > MAX_POINTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The area needs between " + MIN_POINTS + " and " + MAX_POINTS + " points");
        }
        polygon.forEach(p -> validatePoint(p.lat(), p.lng()));
        return polygon;
    }

    private static void validatePoint(double lat, double lng) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordinates out of range");
        }
    }

    /** Build a closed GeoJSON Polygon (GeoJSON wants [lng, lat] order). */
    private static String toGeoJson(List<LatLng> polygon) {
        JSONArray ring = new JSONArray();
        for (LatLng p : polygon) {
            ring.put(new JSONArray(new double[]{p.lng(), p.lat()}));
        }
        LatLng first = polygon.get(0);
        ring.put(new JSONArray(new double[]{first.lng(), first.lat()}));   // close the ring
        return new JSONObject()
                .put("type", "Polygon")
                .put("coordinates", new JSONArray().put(ring))
                .toString();
    }

    /** Outer ring of a GeoJSON Polygon back to lat/lng vertices (unclosed). */
    public static List<LatLng> ringFromGeoJson(String geoJson) {
        JSONArray ring = new JSONObject(geoJson).getJSONArray("coordinates").getJSONArray(0);
        List<LatLng> points = new ArrayList<>();
        for (int i = 0; i < ring.length() - 1; i++) {   // last point repeats the first
            JSONArray p = ring.getJSONArray(i);
            points.add(new LatLng(p.getDouble(1), p.getDouble(0)));
        }
        return points;
    }
}
