package com.carrental.agency;

import com.carrental.agency.dto.CityArea;
import com.carrental.agency.dto.LatLng;
import com.carrental.agency.dto.ServiceAreaCitiesRequest;
import com.carrental.agency.dto.ServiceAreaResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

/**
 * Agency operating areas: the (multi-part) zone a trip must fit inside for the
 * agency to be offered. Two ways to define it — CITIES ("we serve Pune and
 * Nagpur", a radius circle around each, scattered parts allowed) and CUSTOM (a
 * hand-drawn polygon). The geometry is the single source of truth for
 * matching; the definition (mode/cities/radius) is stored alongside so the
 * console re-renders the picker exactly as the agency left it. GeoJSON is
 * built server-side — clients never hand us raw geometry.
 */
@Service
public class ServiceAreaService {

    private static final int MIN_POINTS = 3;
    private static final int MAX_POINTS = 100;

    static final String MODE_CITIES = "CITIES";
    static final String MODE_CUSTOM = "CUSTOM";

    private final ServiceAreaRepository repo;
    private final AgencyRepository agencies;

    public ServiceAreaService(ServiceAreaRepository repo, AgencyRepository agencies) {
        this.repo = repo;
        this.agencies = agencies;
    }

    @Transactional(readOnly = true)
    public ServiceAreaResponse get(Long agencyId) {
        String geoJson = repo.serviceAreaGeoJson(agencyId).orElse(null);
        if (geoJson == null) {
            return ServiceAreaResponse.empty();
        }
        List<List<LatLng>> polygons = ringsFromGeoJson(geoJson);

        String mode = MODE_CUSTOM;   // pre-V17 zones have no stored definition
        Integer radiusKm = null;
        List<CityArea> cities = List.of();
        String defJson = repo.serviceAreaDef(agencyId).orElse(null);
        if (defJson != null) {
            JSONObject def = new JSONObject(defJson);
            mode = def.optString("mode", MODE_CUSTOM);
            radiusKm = def.has("radiusKm") ? def.getInt("radiusKm") : null;
            if (def.has("cities")) {
                List<CityArea> parsed = new ArrayList<>();
                JSONArray arr = def.getJSONArray("cities");
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject c = arr.getJSONObject(i);
                    parsed.add(new CityArea(c.getString("name"), c.getDouble("lat"), c.getDouble("lng")));
                }
                cities = parsed;
            }
        }
        return new ServiceAreaResponse(mode, radiusKm, cities, polygons);
    }

    /** CITIES mode: a radius circle around each picked city (union, may be scattered). */
    @Transactional
    public ServiceAreaResponse updateFromCities(Long agencyId, ServiceAreaCitiesRequest req) {
        requireAgency(agencyId);
        req.cities().forEach(c -> validatePoint(c.lat(), c.lng()));

        JSONArray coords = new JSONArray();
        JSONArray defCities = new JSONArray();
        for (CityArea c : req.cities()) {
            coords.put(new JSONArray(new double[]{c.lng(), c.lat()}));   // GeoJSON: [lng, lat]
            defCities.put(new JSONObject().put("name", c.name()).put("lat", c.lat()).put("lng", c.lng()));
        }
        String multiPoint = new JSONObject()
                .put("type", "MultiPoint")
                .put("coordinates", coords)
                .toString();
        String def = new JSONObject()
                .put("mode", MODE_CITIES)
                .put("radiusKm", req.radiusKm())
                .put("cities", defCities)
                .toString();

        repo.updateServiceAreaFromCities(agencyId, multiPoint, req.radiusKm() * 1000.0, def);
        return get(agencyId);
    }

    /** CUSTOM mode: a hand-drawn simple polygon (outer ring, unclosed). */
    @Transactional
    public ServiceAreaResponse updateCustom(Long agencyId, List<LatLng> polygon) {
        requireAgency(agencyId);
        String geoJson = polygonGeoJson(validateRing(polygon));
        if (!repo.isAcceptablePolygon(geoJson)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The area must be a simple (non self-intersecting) polygon of a sensible size");
        }
        repo.updateServiceArea(agencyId, geoJson,
                new JSONObject().put("mode", MODE_CUSTOM).toString());
        return get(agencyId);
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

    private void requireAgency(Long agencyId) {
        if (!agencies.existsById(agencyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agency not found");
        }
    }

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
    private static String polygonGeoJson(List<LatLng> polygon) {
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

    /**
     * Outer ring(s) of a GeoJSON Polygon or MultiPolygon back to lat/lng
     * vertices (unclosed) — one list per part, so scattered areas map cleanly.
     * Buffer-built parts have no holes; inner rings are ignored by design.
     */
    public static List<List<LatLng>> ringsFromGeoJson(String geoJson) {
        JSONObject geo = new JSONObject(geoJson);
        JSONArray coordinates = geo.getJSONArray("coordinates");
        List<List<LatLng>> polygons = new ArrayList<>();
        if ("Polygon".equals(geo.getString("type"))) {
            polygons.add(ring(coordinates.getJSONArray(0)));
        } else {   // MultiPolygon
            for (int p = 0; p < coordinates.length(); p++) {
                polygons.add(ring(coordinates.getJSONArray(p).getJSONArray(0)));
            }
        }
        return polygons;
    }

    private static List<LatLng> ring(JSONArray closedRing) {
        List<LatLng> points = new ArrayList<>();
        for (int i = 0; i < closedRing.length() - 1; i++) {   // last repeats the first
            JSONArray p = closedRing.getJSONArray(i);
            points.add(new LatLng(p.getDouble(1), p.getDouble(0)));
        }
        return points;
    }
}
