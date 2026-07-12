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
import java.util.Optional;

/**
 * Read-only, cross-tenant search over cars for customers. Lives in its own
 * module (not {@code car}) because it spans {@code car} + {@code booking} +
 * {@code agency}; keeping it here avoids a car<->booking package cycle.
 *
 * <p>Each filter is null-guarded ({@code :p is null or ...}) so one query serves
 * any combination. {@code city}/{@code category} match case-insensitively via
 * {@code lower(column)} — the caller passes already-lowercased values and the
 * free-text {@code keyword} as a ready {@code %pattern%} bound as
 * {@code :keywordPattern} (never {@code lower(:param)}, which
 * fails type inference on a null bind). {@code @EntityGraph} eagerly loads the
 * agency so mapping to {@link CarSearchResult} needs no extra query, while
 * leaving the JPQL free of a fetch join so Spring Data can derive the count.
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
              and (:city is null or lower(c.agency.city) = :city)
              and (:category is null or lower(c.category) = :category)
              and (:keywordPattern is null or lower(c.make) like :keywordPattern or lower(c.model) like :keywordPattern)
              and (:minPrice is null or c.pricePerDay >= :minPrice)
              and (:maxPrice is null or c.pricePerDay <= :maxPrice)
            """;

    @EntityGraph(attributePaths = "agency")
    @Query("select c from Car c where " + FILTERS)
    Page<Car> search(
            @Param("available") CarStatus available,
            @Param("city") String city,
            @Param("category") String category,
            @Param("keywordPattern") String keywordPattern,
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
            @Param("keywordPattern") String keywordPattern,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
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

    // ── Geo proximity search ("cars near me"), ────────────────────────
    // This one is a NATIVE query: distance, radius filtering and nearest-first
    // ordering live in PostGIS functions (ST_Distance/ST_DWithin and the <->
    // operator) that JPQL can't express without hibernate-spatial. The origin is
    // built in SQL from the bound :lng/:lat (geography point, SRID 4326), so the
    // caller only passes plain doubles. The car.geog generated column (V11) and
    // its GiST index back both the radius filter and the ordering.

    /** The search origin as a WGS84 geography point. Reused across the query. */
    String ORIGIN = "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography";

    /**
     * Shared WHERE for the proximity query and its count. AVAILABLE-only (a
     * literal, like the customer search). Text filters reuse the lower(column)
     * functional indexes (caller passes already-lowercased values / a ready
     * %pattern%). The availability window is optional: the {@code cast(:fromTs as
     * timestamptz) is null} guard is the native-SQL equivalent of the two-method
     * split used above — an explicit cast types the null bind, so a missing window
     * skips the not-exists without tripping Postgres "could not determine data
     * type". {@code :blocking} is always passed non-empty (the guard, not an empty
     * IN-list, is what turns availability off).
     */
    String GEO_WHERE = "c.status = 'AVAILABLE' "
            + "and c.geog is not null "
            + "and ST_DWithin(c.geog, " + ORIGIN + ", :radiusMeters) "
            + "and (:category is null or lower(c.category) = :category) "
            + "and (:keywordPattern is null or lower(c.make) like :keywordPattern or lower(c.model) like :keywordPattern) "
            + "and (:minPrice is null or c.price_per_day >= :minPrice) "
            + "and (:maxPrice is null or c.price_per_day <= :maxPrice) "
            + "and (cast(:fromTs as timestamptz) is null "
            + "     or not exists (select 1 from booking b where b.car_id = c.id "
            + "          and b.status in (:blocking) "
            + "          and b.start_ts < :toTs and b.end_ts > :fromTs))";

    @Query(value = "select c.id as \"id\", a.id as \"agencyId\", a.name as \"agencyName\", "
            + "a.city as \"city\", c.make as \"make\", c.model as \"model\", "
            + "c.category as \"category\", c.price_per_day as \"pricePerDay\", "
            + "c.latitude as \"latitude\", c.longitude as \"longitude\", c.status as \"status\", "
            + "ST_Distance(c.geog, " + ORIGIN + ") / 1000.0 as \"distanceKm\" "
            + "from car c join agency a on a.id = c.agency_id "
            + "where " + GEO_WHERE + " "
            + "order by c.geog <-> " + ORIGIN,
            countQuery = "select count(*) from car c join agency a on a.id = c.agency_id "
                    + "where " + GEO_WHERE,
            nativeQuery = true)
    Page<NearbyCarRow> searchNearby(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusMeters") double radiusMeters,
            @Param("category") String category,
            @Param("keywordPattern") String keywordPattern,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("fromTs") OffsetDateTime fromTs,
            @Param("toTs") OffsetDateTime toTs,
            @Param("blocking") Collection<String> blocking,
            Pageable pageable);
}
