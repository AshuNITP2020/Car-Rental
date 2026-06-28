package com.carrental.search;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Customer-facing car search (cross-tenant: any agency's cars).
 *   GET /api/cars/search?city=Mumbai&category=SUV&minPrice=1000&maxPrice=4000
 *       &from=2026-07-01T10:00:00Z&to=2026-07-04T10:00:00Z
 *       &sort=price,asc&page=0&size=20
 *
 * All filters are optional and combine with AND; results are always cars that
 * are AVAILABLE. Supplying from+to additionally drops cars already booked for
 * an overlapping window. Requires authentication (any logged-in user), matching
 * the availability endpoint. (Task #32)
 */
@RestController
public class CarSearchController {

    /** Hard cap so a client can't request an unbounded page. */
    private static final int MAX_PAGE_SIZE = 100;

    private final CarSearchService search;

    public CarSearchController(CarSearchService search) {
        this.search = search;
    }

    @GetMapping("/api/cars/search")
    public PageResponse<CarSearchResult> search(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "price,asc") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        // Treat blank/whitespace filters as "not provided".
        city = blankToNull(city);
        category = blankToNull(category);
        q = blankToNull(q);

        if ((from == null) != (to == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide both 'from' and 'to', or neither");
        }
        if (from != null && !from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'minPrice' must be <= 'maxPrice'");
        }
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'page' must be >= 0");
        }
        if (size < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'size' must be >= 1");
        }
        size = Math.min(size, MAX_PAGE_SIZE);

        return search.search(new CarSearchCriteria(
                city, category, q, minPrice, maxPrice, from, to, sort, page, size));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
