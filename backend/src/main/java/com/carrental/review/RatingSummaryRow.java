package com.carrental.review;

/** Projection for a car's aggregate rating (Task #39). {@code average} is null when there are no reviews. */
public interface RatingSummaryRow {
    Double getAverage();

    long getCount();
}
