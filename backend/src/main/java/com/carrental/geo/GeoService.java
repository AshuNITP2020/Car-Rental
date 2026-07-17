package com.carrental.geo;

import com.carrental.config.CacheConfig;
import com.carrental.geo.dto.PlaceSuggestion;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Place search + reverse lookup for the trip form, proxying the public Photon
 * geocoder (OpenStreetMap data, built for autocomplete). Proxying — rather than
 * calling it from the browser — keeps the provider swappable, lets Redis absorb
 * repeat lookups (geocoding results are stable, so the TTL is long), and keeps
 * our rate limiter in front of it.
 *
 * <p>Results are restricted to India (bbox + countrycode) and to populated
 * places (osm key {@code place}), which is what a pickup/drop field wants —
 * cities, towns and villages, not street addresses. Failures degrade to an
 * empty result: the UI falls back to the operating-cities list.
 */
@Service
public class GeoService {

    private static final Logger log = LoggerFactory.getLogger(GeoService.class);

    /** Rough India bounding box (lon/lat pairs, W,S,E,N) to pre-filter results. */
    private static final String INDIA_BBOX = "68.0,6.0,97.5,37.5";
    private static final int MAX_SUGGESTIONS = 6;
    /** place values that are not populated places a rider would type. */
    private static final Set<String> EXCLUDED_PLACE_VALUES = Set.of("house", "houses", "plot");

    private final RestClient rest;

    public GeoService(@Value("${app.geo.base-url:https://photon.komoot.io}") String baseUrl,
                      @Value("${app.geo.timeout-ms:3000}") long timeoutMs) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(timeoutMs))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofMillis(timeoutMs));
        this.rest = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("User-Agent", "car-rental-marketplace/1.0")
                .requestFactory(factory)
                .build();
    }

    /** Typeahead: places across India matching {@code query}, best-first. */
    @Cacheable(cacheNames = CacheConfig.GEO_SEARCH_CACHE, unless = "#result.isEmpty()")
    public List<PlaceSuggestion> search(String query) {
        try {
            String body = rest.get()
                    .uri(b -> b.path("/api")
                            .queryParam("q", query)
                            .queryParam("lang", "en")
                            .queryParam("limit", 10)
                            .queryParam("osm_tag", "place")
                            .queryParam("bbox", INDIA_BBOX)
                            .build())
                    .retrieve()
                    .body(String.class);
            return parseSearch(body);
        } catch (RuntimeException e) {
            log.warn("geo search '{}' failed: {}", query, e.getMessage());
            return List.of();
        }
    }

    /** Nearest place name for a map pin; {@code null} when nothing is known there. */
    @Cacheable(cacheNames = CacheConfig.GEO_REVERSE_CACHE, unless = "#result == null")
    public PlaceSuggestion reverse(double lat, double lng) {
        try {
            String body = rest.get()
                    .uri(b -> b.path("/reverse")
                            .queryParam("lat", lat)
                            .queryParam("lon", lng)
                            .queryParam("lang", "en")
                            .build())
                    .retrieve()
                    .body(String.class);
            return parseReverse(body, lat, lng);
        } catch (RuntimeException e) {
            log.warn("geo reverse {},{} failed: {}", lat, lng, e.getMessage());
            return null;
        }
    }

    /** Parses a Photon FeatureCollection into deduplicated suggestions. */
    static List<PlaceSuggestion> parseSearch(String json) {
        JSONArray features = new JSONObject(json).optJSONArray("features");
        if (features == null) {
            return List.of();
        }
        List<PlaceSuggestion> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (int i = 0; i < features.length() && out.size() < MAX_SUGGESTIONS; i++) {
            JSONObject feature = features.getJSONObject(i);
            JSONObject props = feature.getJSONObject("properties");
            if (!"IN".equals(props.optString("countrycode"))
                    || EXCLUDED_PLACE_VALUES.contains(props.optString("osm_value"))) {
                continue;
            }
            String name = props.optString("name", "");
            if (name.isBlank()) {
                continue;
            }
            String state = blankToNull(props.optString("state"));
            if (!seen.add(name + "|" + state)) {
                continue;
            }
            JSONArray coords = feature.getJSONObject("geometry").getJSONArray("coordinates");
            out.add(new PlaceSuggestion(name, state, coords.getDouble(1), coords.getDouble(0)));
        }
        return out;
    }

    /**
     * Picks a label for a reverse hit. The nearest feature is often a POI
     * ("treee", a wood) — prefer its containing locality (city/district/county)
     * and only trust {@code name} when the feature itself is a place.
     */
    static PlaceSuggestion parseReverse(String json, double lat, double lng) {
        JSONArray features = new JSONObject(json).optJSONArray("features");
        if (features == null || features.isEmpty()) {
            return null;
        }
        JSONObject props = features.getJSONObject(0).getJSONObject("properties");
        if (!"IN".equals(props.optString("countrycode"))) {
            return null;
        }
        String name = "place".equals(props.optString("osm_key"))
                ? props.optString("name", "")
                : "";
        if (name.isBlank()) {
            name = firstNonBlank(props, "city", "district", "county", "name");
        }
        if (name.isBlank()) {
            return null;
        }
        return new PlaceSuggestion(name, blankToNull(props.optString("state")), lat, lng);
    }

    private static String firstNonBlank(JSONObject props, String... keys) {
        for (String key : keys) {
            String v = props.optString(key, "");
            if (!v.isBlank()) {
                return v;
            }
        }
        return "";
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
