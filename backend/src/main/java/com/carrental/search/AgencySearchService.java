package com.carrental.search;

import com.carrental.booking.BookingStatus;
import com.carrental.car.CarStatus;
import com.carrental.review.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Trip-first agency search: agencies operating at the pickup city, each with
 * its available fleet size (for the window, when given), starting price and
 * aggregate rating. Best-rated agencies first.
 */
@Service
public class AgencySearchService {

    private final AgencySearchRepository repo;
    private final ReviewRepository reviews;

    public AgencySearchService(AgencySearchRepository repo, ReviewRepository reviews) {
        this.repo = repo;
        this.reviews = reviews;
    }

    @Transactional(readOnly = true)
    public List<AgencySearchResult> search(String city, OffsetDateTime from, OffsetDateTime to) {
        String needle = city.trim().toLowerCase(Locale.ROOT);
        List<AgencySearchRepository.AgencyAggRow> rows = from == null
                ? repo.agenciesInCity(CarStatus.AVAILABLE, needle)
                : repo.agenciesInCityBetween(CarStatus.AVAILABLE, needle, from, to, BookingStatus.BLOCKING);
        if (rows.isEmpty()) {
            return List.of();
        }

        Map<Long, ReviewRepository.AgencyRatingRow> ratings =
                reviews.agencyRatingsFor(rows.stream().map(AgencySearchRepository.AgencyAggRow::getAgencyId).toList())
                        .stream()
                        .collect(Collectors.toMap(ReviewRepository.AgencyRatingRow::getAgencyId, Function.identity()));

        return rows.stream()
                .map(r -> {
                    ReviewRepository.AgencyRatingRow rating = ratings.get(r.getAgencyId());
                    return new AgencySearchResult(
                            r.getAgencyId(), r.getName(), r.getCity(), r.getLatitude(), r.getLongitude(),
                            r.getAvailableCars(), r.getFromPrice(),
                            rating != null ? rating.getAverage() : null,
                            rating != null ? rating.getCount() : 0);
                })
                // Best-rated first (unrated last), bigger available fleet breaks ties.
                .sorted(Comparator
                        .comparing(AgencySearchResult::averageRating,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(AgencySearchResult::availableCars, Comparator.reverseOrder()))
                .toList();
    }
}
