package com.carrental.search;

import com.carrental.booking.BookingStatus;
import com.carrental.car.Car;
import com.carrental.car.CarStatus;
import com.carrental.config.CacheConfig;
import com.carrental.review.CarRatingRow;
import com.carrental.review.ReviewRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CarSearchService {

    private final CarSearchRepository repo;
    private final ReviewRepository reviews;

    public CarSearchService(CarSearchRepository repo, ReviewRepository reviews) {
        this.repo = repo;
        this.reviews = reviews;
    }

    @Cacheable(cacheNames = CacheConfig.CAR_SEARCH_CACHE, key = "#carSearchCriteria.cacheKey()",
            condition = "#carSearchCriteria.from() == null")
    @Transactional(readOnly = true)
    public PageResponse<CarSearchResult> search(CarSearchCriteria carSearchCriteria) {
        Pageable pageable = PageRequest.of(carSearchCriteria.page(), carSearchCriteria.size(), sortOf(carSearchCriteria.sort()));

        CarStatus available = CarStatus.AVAILABLE;
        String city = lower(carSearchCriteria.city());
        String category = lower(carSearchCriteria.category());
        String keywordPattern = carSearchCriteria.keyword() == null ? null : "%" + carSearchCriteria.keyword().toLowerCase(Locale.ROOT) + "%";

        Page<Car> page = carSearchCriteria.from() == null
                ? repo.search(available, city, category, keywordPattern, carSearchCriteria.minPrice(),
                        carSearchCriteria.maxPrice(), carSearchCriteria.agencyId(), pageable)
                : repo.searchAvailableBetween(available, city, category, keywordPattern, carSearchCriteria.minPrice(),
                        carSearchCriteria.maxPrice(), carSearchCriteria.agencyId(),
                        carSearchCriteria.from(), carSearchCriteria.to(), BookingStatus.BLOCKING, pageable);

        Page<CarSearchResult> results = page.map(CarSearchResult::from);
        Map<Long, CarRatingRow> ratings = ratingsFor(results.getContent().stream().map(CarSearchResult::id).toList());
        return PageResponse.from(results.map(r -> withRating(r, ratings)));
    }

    /** One bulk aggregate query per page; empty input -> empty map. */
    private Map<Long, CarRatingRow> ratingsFor(List<Long> carIds) {
        if (carIds.isEmpty()) {
            return Map.of();
        }
        return reviews.ratingsForCars(carIds).stream()
                .collect(Collectors.toMap(CarRatingRow::getCarId, Function.identity()));
    }

    private static CarSearchResult withRating(CarSearchResult r, Map<Long, CarRatingRow> ratings) {
        CarRatingRow row = ratings.get(r.id());
        return row == null ? r : r.withRating(row.getAverage(), row.getCount());
    }

    /**
     * Single car by id for the customer-facing car-detail page. Returns any
     * status (availability for a window is checked separately); 404 if unknown.
     */
    @Transactional(readOnly = true)
    public CarSearchResult getById(Long id) {
        CarSearchResult result = repo.findWithAgencyById(id)
                .map(CarSearchResult::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
        return withRating(result, ratingsFor(List.of(id)));
    }

    /**
     * "Cars near me": AVAILABLE cars within {@code radiusKm} of the given
     * lat/lng, ordered nearest-first, with the same optional category/text/price
     * and availability-window filters as {@link #search}. The native query owns
     * the distance ordering (PostGIS {@code <->}), so the {@link Pageable} carries
     * no sort.
     */
    @Transactional(readOnly = true)
    public PageResponse<NearbyCarResult> searchNearby(NearbyCarCriteria c) {
        Pageable pageable = PageRequest.of(c.page(), c.size());
        String category = lower(c.category());
        String keywordPattern = c.keyword() == null ? null : "%" + c.keyword().toLowerCase(Locale.ROOT) + "%";
        // Always non-empty so the SQL "status in (:blocking)" stays valid; whether
        // availability is actually checked is decided by the from/to guard, not this.
        var blocking = BookingStatus.BLOCKING.stream().map(Enum::name).toList();

        Page<NearbyCarRow> page = repo.searchNearby(
                c.lat(), c.lng(), c.radiusKm() * 1000.0,
                category, keywordPattern, c.minPrice(), c.maxPrice(),
                c.from(), c.to(), blocking, pageable);

        Page<NearbyCarResult> results = page.map(NearbyCarResult::from);
        Map<Long, CarRatingRow> ratings =
                ratingsFor(results.getContent().stream().map(r -> r.car().id()).toList());
        return PageResponse.from(results.map(r -> {
            CarRatingRow row = ratings.get(r.car().id());
            return row == null ? r : r.withRating(row.getAverage(), row.getCount());
        }));
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
