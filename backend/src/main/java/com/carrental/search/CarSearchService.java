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
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CarSearchService {

    /** Cheapest first; the id tie-break keeps paging deterministic. */
    private static final Sort SORT = Sort.by(Sort.Direction.ASC, "pricePerDay")
            .and(Sort.by(Sort.Direction.ASC, "id"));

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
        Pageable pageable = PageRequest.of(carSearchCriteria.page(), carSearchCriteria.size(), SORT);

        Page<Car> page = carSearchCriteria.from() == null
                ? repo.search(CarStatus.AVAILABLE, carSearchCriteria.agencyId(), pageable)
                : repo.searchAvailableBetween(CarStatus.AVAILABLE, carSearchCriteria.agencyId(),
                        carSearchCriteria.from(), carSearchCriteria.to(), BookingStatus.BLOCKING, pageable);

        Page<CarSearchResult> results = page.map(CarSearchResult::from);
        Map<Long, CarRatingRow> ratings = ratingsFor(results.getContent().stream().map(CarSearchResult::id).toList());
        return PageResponse.from(results.map(r -> withRating(r, ratings)));
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
}
