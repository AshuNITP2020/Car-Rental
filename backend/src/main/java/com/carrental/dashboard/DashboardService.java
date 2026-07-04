package com.carrental.dashboard;

import com.carrental.booking.BookingStatus;
import com.carrental.car.CarStatus;
import com.carrental.dashboard.AgencyDashboardResponse.BookingSummary;
import com.carrental.dashboard.AgencyDashboardResponse.FleetSummary;
import com.carrental.dashboard.AgencyDashboardResponse.MonthlyTrend;
import com.carrental.dashboard.AgencyDashboardResponse.RevenueSummary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Builds an agency's dashboard from the aggregation queries. Read-only
 * and tenant-scoped; uses {@code OffsetDateTime.now()} for window bounds, matching
 * the rest of the codebase (there's no clock service). "Realized" bookings —
 * CONFIRMED/ACTIVE/COMPLETED — are the ones that count toward revenue and
 * recent-activity; PENDING/CANCELLED/EXPIRED don't.
 */
@Service
public class DashboardService {

    /** Bookings that represent real, non-cancelled business. */
    private static final Set<BookingStatus> REALIZED =
            EnumSet.of(BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED);
    private static final OffsetDateTime EPOCH = OffsetDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);
    private static final int RECENT_DAYS = 30;
    private static final int TREND_MONTHS = 6;

    private final DashboardRepository repo;

    public DashboardService(DashboardRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public AgencyDashboardResponse forAgency(Long agencyId) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime recentSince = now.minusDays(RECENT_DAYS);
        OffsetDateTime trendSince = now.minusMonths(TREND_MONTHS).withDayOfMonth(1);

        Map<String, Long> fleetByStatus = new LinkedHashMap<>();
        long totalCars = 0;
        for (CarStatusCount row : repo.carsByStatus(agencyId)) {
            fleetByStatus.put(row.getStatus().name(), row.getCount());
            totalCars += row.getCount();
        }

        // Bookings: counts per booking status (+ total).
        Map<String, Long> bookingsByStatus = new LinkedHashMap<>();
        long totalBookings = 0;
        for (BookingStatusCount row : repo.bookingsByStatus(agencyId)) {
            bookingsByStatus.put(row.getStatus().name(), row.getCount());
            totalBookings += row.getCount();
        }

        // Revenue: all-time and last 30 days.
        BigDecimal totalRevenue = nz(repo.revenueSince(agencyId, REALIZED, EPOCH));
        BigDecimal recentRevenue = nz(repo.revenueSince(agencyId, REALIZED, recentSince));

        // Utilization right now: fraction of the fleet currently booked.
        long bookedNow = repo.carsBookedAt(agencyId, BookingStatus.BLOCKING, now);
        double utilization = totalCars == 0 ? 0.0
                : Math.round(bookedNow * 100.0 / totalCars * 10.0) / 10.0;   // 1 decimal

        long idleCars = repo.idleCarCount(agencyId, CarStatus.AVAILABLE, REALIZED, recentSince);

        List<MonthlyTrend> trends = repo.monthlyTrends(agencyId, trendSince).stream()
                .map(row -> new MonthlyTrend(row.getMonth(), row.getBookings(), nz(row.getRevenue())))
                .toList();

        return new AgencyDashboardResponse(
                new FleetSummary(totalCars, fleetByStatus),
                new BookingSummary(totalBookings, bookingsByStatus),
                new RevenueSummary(totalRevenue, recentRevenue),
                utilization,
                idleCars,
                trends);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
