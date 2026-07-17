package com.carrental.search;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Trip-first search: "which agencies operate at my pickup pin for my dates?"
 *   GET /api/agencies/search?lat=19.07&lng=72.87&from=…&to=…
 * from/to are optional but must come as a pair; with a window only cars that
 * are actually free then are counted. Requires authentication like car search.
 */
@RestController
public class AgencySearchController {

    private final AgencySearchService search;

    public AgencySearchController(AgencySearchService search) {
        this.search = search;
    }

    @GetMapping("/api/agencies/search")
    public List<AgencySearchResult> search(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordinates out of range");
        }
        if ((from == null) != (to == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide both 'from' and 'to', or neither");
        }
        if (from != null && !from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        return search.search(lat, lng, from, to);
    }
}
