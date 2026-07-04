package com.carrental.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body for creating a review (Task #39): a 1–5 star rating and an optional comment. */
public record CreateReviewRequest(
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 2000) String comment
) {
}
