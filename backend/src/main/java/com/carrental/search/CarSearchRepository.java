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

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collection;

/**
 * Read-only, cross-tenant search over cars for customers. Lives in its own
 * module (not {@code car}) because it spans {@code car} + {@code booking} +
 * {@code agency}; keeping it here avoids a car<->booking package cycle.
 *
 * <p>Each filter is null-guarded ({@code :p is null or ...}) so one query serves
 * any combination. {@code city}/{@code category} match case-insensitively via
 * {@code lower(column)} — the caller passes already-lowercased values and
 * {@code q} as a ready {@code %pattern%} (never {@code lower(:param)}, which
 * fails type inference on a null bind). {@code @EntityGraph} eagerly loads the
 * agency so mapping to {@link CarSearchResult} needs no extra query, while
 * leaving the JPQL free of a fetch join so Spring Data can derive the count.
 *
 * <p>Two methods on purpose: availability ({@code not exists} against blocking
 * bookings) lives only in {@link #searchAvailableBetween} where {@code from}/
 * {@code to} are guaranteed non-null. Keeping a nullable timestamp out of an
 * {@code IS NULL} guard avoids Postgres "could not determine data type". (Task #32)
 */
public interface CarSearchRepository extends Repository<Car, Long> {

    /** Shared filter block — everything except the availability window. */
    String FILTERS = """
            c.status = :available
              and (:city is null or lower(c.agency.city) = :city)
              and (:category is null or lower(c.category) = :category)
              and (:q is null or lower(c.make) like :q or lower(c.model) like :q)
              and (:minPrice is null or c.pricePerDay >= :minPrice)
              and (:maxPrice is null or c.pricePerDay <= :maxPrice)
            """;

    @EntityGraph(attributePaths = "agency")
    @Query("select c from Car c where " + FILTERS)
    Page<Car> search(
            @Param("available") CarStatus available,
            @Param("city") String city,
            @Param("category") String category,
            @Param("q") String q,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            Pageable pageable);

    @EntityGraph(attributePaths = "agency")
    @Query("select c from Car c where " + FILTERS
            + " and not exists (select 1 from Booking b where b.car = c"
            + " and b.status in :blocking and b.startTs < :to and b.endTs > :from)")
    Page<Car> searchAvailableBetween(
            @Param("available") CarStatus available,
            @Param("city") String city,
            @Param("category") String category,
            @Param("q") String q,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            @Param("blocking") Collection<BookingStatus> blocking,
            Pageable pageable);
}
