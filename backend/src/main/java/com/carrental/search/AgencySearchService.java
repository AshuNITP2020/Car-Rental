package com.carrental.search;

import com.carrental.agency.ServiceAreaService;
import com.carrental.booking.BookingStatus;
import com.carrental.review.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Trip-first agency search: agencies whose operating polygon covers the pickup
 * pin, each with its available fleet size (for the window, when given),
 * starting price, aggregate rating and distance. Nearest agency first.
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
    public List<AgencySearchResult> search(double lat, double lng, Double dropLat, Double dropLng,
                                           OffsetDateTime from, OffsetDateTime to) {
        List<AgencySearchRepository.AgencyAggRow> rows = from == null
                ? repo.agenciesCovering(lat, lng, dropLat, dropLng)
                : repo.agenciesCoveringBetween(lat, lng, dropLat, dropLng, from, to,
                        BookingStatus.BLOCKING.stream().map(Enum::name).toList());
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
                            rating != null ? rating.getCount() : 0,
                            round2(r.getDistanceKm()),
                            r.getServiceAreaGeoJson() != null
                                    ? ServiceAreaService.ringFromGeoJson(r.getServiceAreaGeoJson())
                                    : null);
                })
                .toList();   // repository already orders nearest-first
    }

    private static Double round2(Double km) {
        return km == null ? null : BigDecimal.valueOf(km).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
