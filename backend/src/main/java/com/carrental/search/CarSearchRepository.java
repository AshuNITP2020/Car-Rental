package com.carrental.search;

import com.carrental.booking.BookingStatus;
import com.carrental.car.Car;
import com.carrental.car.CarStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Optional;

/**
 * Read-only, cross-tenant search over cars for customers. Lives in its own
 * module (not {@code car}) because it spans {@code car} + {@code booking} +
 * {@code agency}; keeping it here avoids a car<->booking package cycle.
 *
 * <p>{@code @EntityGraph} eagerly loads the agency so mapping to
 * {@link CarSearchResult} needs no extra query, while leaving the JPQL free of
 * a fetch join so Spring Data can derive the count.
 *
 * <p>Two methods on purpose: availability ({@code not exists} against blocking
 * bookings) lives only in {@link #searchAvailableBetween} where {@code from}/
 * {@code to} are guaranteed non-null. Keeping a nullable timestamp out of an
 * {@code IS NULL} guard avoids Postgres "could not determine data type".
 */
public interface CarSearchRepository extends Repository<Car, Long> {

    /** Shared filter block — everything except the availability window. */
    String FILTERS = """
            c.status = :available
              and (:agencyId is null or c.agency.id = :agencyId)
            """;

    @EntityGraph(attributePaths = "agency")
    @Query("select c from Car c where " + FILTERS)
    Page<Car> search(
            @Param("available") CarStatus available,
            @Param("agencyId") Long agencyId,
            Pageable pageable);

    @EntityGraph(attributePaths = "agency")
    @Query("select c from Car c where " + FILTERS
            + " and not exists (select 1 from Booking b where b.car = c"
            + " and b.status in :blocking and b.startTs < :to and b.endTs > :from)")
    Page<Car> searchAvailableBetween(
            @Param("available") CarStatus available,
            @Param("agencyId") Long agencyId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            @Param("blocking") Collection<BookingStatus> blocking,
            Pageable pageable);

    /**
     * Single car by id with its agency eagerly loaded, for the customer-facing
     * car-detail page (which otherwise only has the per-car sub-resources). Any
     * status is returned — availability for a given window is a separate call.
     */
    @EntityGraph(attributePaths = "agency")
    @Query("select c from Car c where c.id = :id")
    Optional<Car> findWithAgencyById(@Param("id") Long id);
}
