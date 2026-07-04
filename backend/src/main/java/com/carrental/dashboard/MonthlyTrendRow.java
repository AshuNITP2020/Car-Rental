package com.carrental.dashboard;

import java.math.BigDecimal;

/** Projection for the native monthly-trend query. */
public interface MonthlyTrendRow {
    String getMonth();

    long getBookings();

    BigDecimal getRevenue();
}
