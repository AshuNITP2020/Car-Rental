package com.carrental.geo;

import com.carrental.geo.dto.PlaceSuggestion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Geocoding for the trip form.
 *   GET /api/geo/search?q=coimb      -> places across India matching the text
 *   GET /api/geo/reverse?lat=&lng=   -> nearest place name for a map pin (204 if unknown)
 */
@RestController
@RequestMapping("/api/geo")
@Validated
public class GeoController {

    private final GeoService geo;

    public GeoController(GeoService geo) {
        this.geo = geo;
    }

    @GetMapping("/search")
    public List<PlaceSuggestion> search(@RequestParam @NotBlank @Size(max = 80) String q) {
        String query = q.trim();
        return query.length() < 2 ? List.of() : geo.search(query.toLowerCase());
    }

    @GetMapping("/reverse")
    public ResponseEntity<PlaceSuggestion> reverse(@RequestParam double lat, @RequestParam double lng) {
        // Snap to ~110 m so nearby pins (and drags) share one cache entry.
        PlaceSuggestion place = geo.reverse(round3(lat), round3(lng));
        return place == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(place);
    }

    private static double round3(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
