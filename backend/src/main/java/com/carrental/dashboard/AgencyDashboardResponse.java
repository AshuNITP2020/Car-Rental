package com.carrental.dashboard;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * An agency's dashboard snapshot: fleet + booking breakdowns, revenue,
 * how much of the fleet is in use right now, idle cars, and a monthly trend. All
 * figures are scoped to one agency. "Revenue" is the rental amount of realized
 * bookings (CONFIRMED/ACTIVE/COMPLETED) — gross booking value, before platform
 * fees; it could later be refined to captured-minus-refunded payments.
 */
public record AgencyDashboardResponse(
        FleetSummary fleet,
        BookingSummary bookings,
        RevenueSummary revenue,
        double utilizationPercent,
        long idleCarCount,
        List<MonthlyTrend> trends
) {
    /** Total cars and a count per {@code CarStatus} (AVAILABLE, BOOKED, …). */
    public record FleetSummary(long totalCars, Map<String, Long> byStatus) {
    }

    /** Total bookings and a count per {@code BookingStatus}. */
    public record BookingSummary(long totalBookings, Map<String, Long> byStatus) {
    }

    /** Realized revenue all-time and over the last 30 days. */
    public record RevenueSummary(BigDecimal total, BigDecimal last30Days) {
    }

    /** One month of the trend: {@code "YYYY-MM"}, bookings created, realized revenue. */
    public record MonthlyTrend(String month, long bookings, BigDecimal revenue) {
    }
}
