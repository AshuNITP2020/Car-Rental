package com.carrental.review;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.review.dto.CarReviewsResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public-facing (any authenticated user) reviews for a car (Task #39): the list
 * plus the aggregate rating, in one payload for a car page.
 *   GET /api/cars/{carId}/reviews
 */
@Tag(name = "Reviews", description = "Car reviews left by customers after completed trips")
@RestController
public class CarReviewController {

    private final ReviewService reviews;

    public CarReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping("/api/cars/{carId}/reviews")
    public CarReviewsResponse list(@PathVariable Long carId) {
        return reviews.carReviews(carId);
    }
}
