package com.carrental.review.dto;

/** An agency's aggregate rating across all its cars' reviews. */
public record AgencyRatingResponse(Double averageRating, long reviewCount) {
}
