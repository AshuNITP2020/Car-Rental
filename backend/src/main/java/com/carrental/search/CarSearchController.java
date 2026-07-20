package com.carrental.search;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

/**
 * Customer-facing car search (cross-tenant), trimmed to what the trip-first
 * flow needs: available cars, optionally one agency's fleet, optionally free
 * for a window. Cheapest first. Requires authentication (any logged-in user).
 *   GET /api/cars/search?agencyId=42&from=…&to=…&page=0&size=20
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
            @RequestParam(required = false) Long agencyId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer minSeats,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        validateWindow(from, to);
        size = validatePaging(page, size);
        String type = category != null && !category.isBlank() ? category.trim() : null;

        return search.search(new CarSearchCriteria(agencyId, type, minSeats, from, to, page, size));
    }

    /**
     * A single car's core fields (make/model/price/agency), for the customer
     * car-detail page. Authenticated like search. 404 if the car doesn't exist.
     *   GET /api/cars/42
     */
    @GetMapping("/api/cars/{id}")
    public CarSearchResult getCar(@PathVariable Long id) {
        return search.getById(id);
    }

    private static void validateWindow(OffsetDateTime from, OffsetDateTime to) {
        if ((from == null) != (to == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide both 'from' and 'to', or neither");
        }
        if (from != null && !from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
    }

    /** Validates page/size and returns the size clamped to {@link #MAX_PAGE_SIZE}. */
    private static int validatePaging(int page, int size) {
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'page' must be >= 0");
        }
        if (size < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'size' must be >= 1");
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
