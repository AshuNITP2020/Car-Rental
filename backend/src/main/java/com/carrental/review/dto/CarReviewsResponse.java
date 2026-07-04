package com.carrental.review.dto;

import java.util.List;

/**
 * A car's reviews plus its aggregate rating (Task #39). {@code averageRating} is
 * null when the car has no reviews yet.
 */
public record CarReviewsResponse(
        Double averageRating,
        long count,
        List<ReviewResponse> reviews
) {
}
