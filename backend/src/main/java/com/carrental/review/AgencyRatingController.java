package com.carrental.review;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.agency.AgencyRepository;
import com.carrental.review.dto.AgencyRatingResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * An agency's public trust score: the aggregate rating across every review of
 * its cars. Feeds the customer-facing agency profile page.
 *   GET /api/agencies/{id}/rating
 */
@Tag(name = "Agency ratings", description = "Aggregate rating across an agency\u2019s fleet")
@RestController
public class AgencyRatingController {

    private final ReviewRepository reviews;
    private final AgencyRepository agencies;

    public AgencyRatingController(ReviewRepository reviews, AgencyRepository agencies) {
        this.reviews = reviews;
        this.agencies = agencies;
    }

    @GetMapping("/api/agencies/{id}/rating")
    public AgencyRatingResponse rating(@PathVariable Long id) {
        if (!agencies.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agency not found");
        }
        RatingSummaryRow row = reviews.agencyRatingSummary(id);
        return new AgencyRatingResponse(row.getAverage(), row.getCount());
    }
}
