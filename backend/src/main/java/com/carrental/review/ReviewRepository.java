package com.carrental.review;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    boolean existsByBookingId(Long bookingId);

    Optional<Review> findByBookingId(Long bookingId);

    /** A car's reviews, newest first. */
    List<Review> findByCarIdOrderByIdDesc(Long carId);

    /** Aggregate rating for a car — {@code average} is null when the car has no reviews. */
    @Query("select avg(r.rating) as average, count(r) as count from Review r where r.carId = :carId")
    RatingSummaryRow ratingSummary(@Param("carId") Long carId);
}
