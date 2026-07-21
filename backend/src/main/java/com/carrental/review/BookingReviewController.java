package com.carrental.review;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.auth.AuthPrincipal;
import com.carrental.review.dto.CreateReviewRequest;
import com.carrental.review.dto.ReviewResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A customer reviews their own completed booking (Task #39). Scoped to the
 * authenticated user; the service enforces "your booking, completed, once".
 *   POST /api/bookings/{bookingId}/review   (body: rating 1–5, optional comment)
 *   GET  /api/bookings/{bookingId}/review
 */
@Tag(name = "Booking reviews", description = "Create/read the review attached to a booking")
@RestController
@RequestMapping("/api/bookings/{bookingId}/review")
public class BookingReviewController {

    private final ReviewService reviews;

    public BookingReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @PostMapping
    public ResponseEntity<ReviewResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                                 @PathVariable Long bookingId,
                                                 @Valid @RequestBody CreateReviewRequest req) {
        ReviewResponse created = reviews.create(principal.userId(), bookingId, req.rating(), req.comment());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ReviewResponse get(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long bookingId) {
        return reviews.getForBooking(principal.userId(), bookingId);
    }
}
