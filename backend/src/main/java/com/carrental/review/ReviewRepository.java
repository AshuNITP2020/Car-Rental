package com.carrental.review;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    /** Bulk aggregate ratings for a page of cars (one query per search page). */
    @Query("select r.carId as carId, avg(r.rating) as average, count(r) as count"
            + " from Review r where r.carId in :carIds group by r.carId")
    List<CarRatingRow> ratingsForCars(@Param("carIds") Collection<Long> carIds);

    /** Aggregate rating across every car an agency owns (its public "trust" score). */
    @Query("select avg(r.rating) as average, count(r) as count from Review r"
            + " where r.carId in (select c.id from Car c where c.agency.id = :agencyId)")
    RatingSummaryRow agencyRatingSummary(@Param("agencyId") Long agencyId);

    /** Projection for bulk per-agency aggregate ratings. */
    interface AgencyRatingRow {
        Long getAgencyId();

        Double getAverage();

        long getCount();
    }

    /** Bulk per-agency ratings for a page of agency-search results (one query). */
    @Query("select c.agency.id as agencyId, avg(r.rating) as average, count(r) as count"
            + " from Review r, Car c where c.id = r.carId and c.agency.id in :agencyIds"
            + " group by c.agency.id")
    List<AgencyRatingRow> agencyRatingsFor(@Param("agencyIds") Collection<Long> agencyIds);
}
