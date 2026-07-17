package com.carrental.geo;

import com.carrental.geo.dto.PlaceSuggestion;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure parsing tests for the Photon response mapping — no Spring context, no
 * network. Fixtures mirror real Photon payloads (see GeoService).
 */
class GeoServiceParseTest {

    private static String feature(String name, String osmKey, String osmValue,
                                  String state, String country, double lng, double lat) {
        return """
                {"type":"Feature",
                 "properties":{"name":"%s","osm_key":"%s","osm_value":"%s",
                               "state":"%s","countrycode":"%s"},
                 "geometry":{"type":"Point","coordinates":[%f,%f]}}
                """.formatted(name, osmKey, osmValue, state, country, lng, lat);
    }

    private static String collection(String... features) {
        return "{\"type\":\"FeatureCollection\",\"features\":[" + String.join(",", features) + "]}";
    }

    @Test
    void searchKeepsIndianPlacesAndDedupes() {
        String json = collection(
                feature("Coimbatore", "place", "city", "Tamil Nadu", "IN", 76.96, 11.00),
                feature("Coimbatore", "place", "city", "Tamil Nadu", "IN", 76.97, 11.01), // dup name+state
                feature("Colombo", "place", "city", "Western", "LK", 79.86, 6.93),        // not India
                feature("Somewhere", "place", "house", "Kerala", "IN", 76.0, 10.0));      // address, not a place

        List<PlaceSuggestion> out = GeoService.parseSearch(json);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).name()).isEqualTo("Coimbatore");
        assertThat(out.get(0).state()).isEqualTo("Tamil Nadu");
        assertThat(out.get(0).lat()).isEqualTo(11.00);
        assertThat(out.get(0).lng()).isEqualTo(76.96);
    }

    @Test
    void searchHandlesEmptyAndMalformedShapes() {
        assertThat(GeoService.parseSearch("{\"type\":\"FeatureCollection\",\"features\":[]}")).isEmpty();
        assertThat(GeoService.parseSearch("{}")).isEmpty();
    }

    @Test
    void reverseUsesPlaceNameWhenFeatureIsAPlace() {
        String json = collection(feature("Kurla", "place", "suburb", "Maharashtra", "IN", 72.88, 19.07));

        PlaceSuggestion place = GeoService.parseReverse(json, 19.07, 72.88);

        assertThat(place).isNotNull();
        assertThat(place.name()).isEqualTo("Kurla");
        assertThat(place.state()).isEqualTo("Maharashtra");
        // reverse keeps the queried pin, not the feature's own centroid
        assertThat(place.lat()).isEqualTo(19.07);
        assertThat(place.lng()).isEqualTo(72.88);
    }

    @Test
    void reversePrefersContainingCityOverPoiName() {
        // Real shape: nearest feature is a wood named "treee" inside Mumbai.
        String json = """
                {"type":"FeatureCollection","features":[
                  {"type":"Feature",
                   "properties":{"name":"treee","osm_key":"natural","osm_value":"wood",
                                 "city":"Mumbai","state":"Maharashtra","countrycode":"IN"},
                   "geometry":{"type":"Point","coordinates":[72.877,19.076]}}]}
                """;

        PlaceSuggestion place = GeoService.parseReverse(json, 19.076, 72.877);

        assertThat(place).isNotNull();
        assertThat(place.name()).isEqualTo("Mumbai");
    }

    @Test
    void reverseReturnsNullOutsideIndiaOrWhenEmpty() {
        String abroad = collection(feature("Colombo", "place", "city", "Western", "LK", 79.86, 6.93));
        assertThat(GeoService.parseReverse(abroad, 6.93, 79.86)).isNull();
        assertThat(GeoService.parseReverse("{\"type\":\"FeatureCollection\",\"features\":[]}", 0, 0)).isNull();
    }
}
