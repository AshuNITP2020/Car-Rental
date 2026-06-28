package com.carrental.search;

import com.carrental.booking.BookingStatus;
import com.carrental.car.Car;
import com.carrental.car.CarStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class CarSearchService {

    private final CarSearchRepository repo;

    public CarSearchService(CarSearchRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public PageResponse<CarSearchResult> search(CarSearchCriteria c) {
        Pageable pageable = PageRequest.of(c.page(), c.size(), sortOf(c.sort()));
        // Lowercase here (not in SQL) so the query never calls lower() on a bind
        // parameter — lower(:nullParam) fails Postgres type inference. The text
        // filters then match the lower(column) functional indexes (V10).
        CarStatus available = CarStatus.AVAILABLE;   // customer search only returns bookable cars
        String city = lower(c.city());
        String category = lower(c.category());
        String q = c.q() == null ? null : "%" + c.q().toLowerCase(Locale.ROOT) + "%";

        Page<Car> page = c.from() == null
                ? repo.search(available, city, category, q, c.minPrice(), c.maxPrice(), pageable)
                : repo.searchAvailableBetween(available, city, category, q, c.minPrice(), c.maxPrice(),
                        c.from(), c.to(), BookingStatus.BLOCKING, pageable);
        return PageResponse.from(page.map(CarSearchResult::from));
    }

    private static String lower(String s) {
        return s == null ? null : s.toLowerCase(Locale.ROOT);
    }

    /**
     * Maps a friendly "field[,dir]" sort onto entity fields, rejecting anything
     * not allow-listed (so a client can't sort by — or probe — arbitrary
     * columns). A trailing {@code id asc} makes paging deterministic when the
     * primary sort key ties.
     */
    private Sort sortOf(String sort) {
        String[] parts = sort.split(",", 2);
        String key = parts[0].trim().toLowerCase();
        String dir = parts.length > 1 ? parts[1].trim().toLowerCase() : "asc";

        String field = switch (key) {
            case "price" -> "pricePerDay";
            case "newest", "created", "createdat" -> "createdAt";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown sort field '" + key + "' (allowed: price, newest)");
        };
        Sort.Direction direction = switch (dir) {
            case "asc" -> Sort.Direction.ASC;
            case "desc" -> Sort.Direction.DESC;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown sort direction '" + dir + "' (allowed: asc, desc)");
        };
        return Sort.by(direction, field).and(Sort.by(Sort.Direction.ASC, "id"));
    }
}
