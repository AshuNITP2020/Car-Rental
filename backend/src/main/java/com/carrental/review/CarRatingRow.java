package com.carrental.review;

/** Projection for bulk per-car aggregate ratings (search-result enrichment). */
public interface CarRatingRow {
    Long getCarId();

    Double getAverage();

    long getCount();
}
