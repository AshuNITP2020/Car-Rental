package com.carrental.review.dto;

import com.carrental.review.Review;

import java.time.OffsetDateTime;

/** One review as returned to clients (Task #39). */
public record ReviewResponse(
        Long id,
        Long bookingId,
        Long carId,
        int rating,
        String comment,
        OffsetDateTime createdAt
) {
    public static ReviewResponse from(Review r) {
        return new ReviewResponse(r.getId(), r.getBookingId(), r.getCarId(),
                r.getRating(), r.getComment(), r.getCreatedAt());
    }
}
