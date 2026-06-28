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
    /** Cap proximity radius so a query can't degrade into a full scan of the fleet. */
    private static final double MAX_RADIUS_KM = 500;

    private final CarSearchService search;

    public CarSearchController(CarSearchService search) {
        this.search = search;
    }

    @GetMapping("/api/cars/search")
    public PageResponse<CarSearchResult> search(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String category,
            @RequestParam(name = "q", required = false) String keyword,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "price,asc") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        city = blankToNull(city);
        category = blankToNull(category);
        keyword = blankToNull(keyword);

        validateWindow(from, to);
        validatePriceRange(minPrice, maxPrice);
        size = validatePaging(page, size);

        return search.search(new CarSearchCriteria(
                city, category, keyword, minPrice, maxPrice, from, to, sort, page, size));
    }

    /**
     * "Cars near me": AVAILABLE cars within {@code radiusKm} of (lat, lng),
     * nearest first. The same optional filters as {@link #search} apply (minus
     * city/sort — proximity replaces both).
     *   GET /api/cars/search/nearby?lat=19.07&lng=72.87&radiusKm=10&category=SUV
     */
    @GetMapping("/api/cars/search/nearby")
    public PageResponse<NearbyCarResult> nearby(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "25") double radiusKm,
            @RequestParam(required = false) String category,
            @RequestParam(name = "q", required = false) String keyword,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        category = blankToNull(category);
        keyword = blankToNull(keyword);

        if (lat < -90 || lat > 90) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'lat' must be between -90 and 90");
        }
        if (lng < -180 || lng > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'lng' must be between -180 and 180");
        }
        if (radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "'radiusKm' must be between 0 (exclusive) and " + MAX_RADIUS_KM);
        }
        validateWindow(from, to);
        validatePriceRange(minPrice, maxPrice);
        size = validatePaging(page, size);

        return search.searchNearby(new NearbyCarCriteria(
                lat, lng, radiusKm, category, keyword, minPrice, maxPrice, from, to, page, size));
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

    private static void validatePriceRange(BigDecimal minPrice, BigDecimal maxPrice) {
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'minPrice' must be <= 'maxPrice'");
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

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
