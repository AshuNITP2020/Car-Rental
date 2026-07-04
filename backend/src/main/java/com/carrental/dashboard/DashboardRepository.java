package com.carrental.dashboard;

import com.carrental.booking.Booking;
import com.carrental.booking.BookingStatus;
import com.carrental.car.CarStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Read-only aggregation queries for the agency dashboard. Every query
 * is scoped to one {@code agencyId}, so an agency only ever sees its own numbers
 * (and the ~5k seed rows in other agencies never leak in). Rooted at {@link Booking}
 * only as a marker — the {@code @Query} methods select from whatever entity they
 * need. Timestamp bounds are always passed as a concrete value (never a nullable
 * bind), sidestepping Postgres "could not determine data type".
 */
public interface DashboardRepository extends Repository<Booking, Long> {

    @Query("select c.status as status, count(c) as count from Car c "
            + "where c.agency.id = :agencyId group by c.status")
    List<CarStatusCount> carsByStatus(@Param("agencyId") Long agencyId);

    @Query("select b.status as status, count(b) as count from Booking b "
            + "where b.agency.id = :agencyId group by b.status")
    List<BookingStatusCount> bookingsByStatus(@Param("agencyId") Long agencyId);

    /** Sum of rental amounts for realized bookings created on/after {@code since}. Null if none. */
    @Query("select sum(b.amount) from Booking b where b.agency.id = :agencyId "
            + "and b.status in :realized and b.createdAt >= :since")
    BigDecimal revenueSince(@Param("agencyId") Long agencyId,
                            @Param("realized") Collection<BookingStatus> realized,
                            @Param("since") OffsetDateTime since);

    /** Distinct cars with a blocking booking spanning {@code at} — i.e. in use then. */
    @Query("select count(distinct b.car.id) from Booking b where b.agency.id = :agencyId "
            + "and b.status in :blocking and b.startTs <= :at and b.endTs > :at")
    long carsBookedAt(@Param("agencyId") Long agencyId,
                      @Param("blocking") Collection<BookingStatus> blocking,
                      @Param("at") OffsetDateTime at);

    /** AVAILABLE cars with no realized booking ending on/after {@code since} (idle recently). */
    @Query("select count(c) from Car c where c.agency.id = :agencyId and c.status = :available "
            + "and not exists (select 1 from Booking b where b.car = c "
            + "and b.status in :realized and b.endTs > :since)")
    long idleCarCount(@Param("agencyId") Long agencyId,
                      @Param("available") CarStatus available,
                      @Param("realized") Collection<BookingStatus> realized,
                      @Param("since") OffsetDateTime since);

    /** Per-month bookings + realized revenue since {@code since}, oldest month first. */
    @Query(value = """
            select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                   count(*) as bookings,
                   coalesce(sum(case when status in ('CONFIRMED','ACTIVE','COMPLETED')
                                     then amount else 0 end), 0) as revenue
            from booking
            where agency_id = :agencyId and created_at >= :since
            group by date_trunc('month', created_at)
            order by date_trunc('month', created_at)
            """, nativeQuery = true)
    List<MonthlyTrendRow> monthlyTrends(@Param("agencyId") Long agencyId,
                                        @Param("since") OffsetDateTime since);
}
