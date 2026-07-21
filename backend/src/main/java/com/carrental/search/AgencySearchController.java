package com.carrental.search;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Trip-first search: "which agencies can run my trip, for my dates?"
 *   GET /api/agencies/search?lat=19.07&lng=72.87[&dlat=…&dlng=…][&from=…&to=…]
 * With a destination, only agencies whose single zone covers BOTH ends match —
 * an agency's cars never leave its own operating area. from/to are optional
 * but must come as a pair; with a window only cars actually free then count.
 */
@Tag(name = "Trip search", description = "Find agencies that can run a whole trip (pickup + destination inside ONE operating area), filtered by car type/seats and dates")
@RestController
public class AgencySearchController {

    private final AgencySearchService search;

    public AgencySearchController(AgencySearchService search) {
        this.search = search;
    }

    @Operation(summary = "Agencies that can run the trip",
            description = "With dlat/dlng, only agencies whose SINGLE operating area covers both ends match — an agency's cars never leave its zone. carType/seats drop cars that don't fit; from/to counts only cars free for the window.")
    @GetMapping("/api/agencies/search")
    public List<AgencySearchResult> search(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Double dlat,
            @RequestParam(required = false) Double dlng,
            @RequestParam(required = false) String carType,
            @RequestParam(required = false) Integer seats,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        validateCoords(lat, lng);
        if ((dlat == null) != (dlng == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide both 'dlat' and 'dlng', or neither");
        }
        if (dlat != null) {
            validateCoords(dlat, dlng);
        }
        if ((from == null) != (to == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide both 'from' and 'to', or neither");
        }
        if (from != null && !from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        String type = carType != null && !carType.isBlank() ? carType.trim() : null;
        return search.search(lat, lng, dlat, dlng, type, seats, from, to);
    }

    private static void validateCoords(double lat, double lng) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordinates out of range");
        }
    }
}
