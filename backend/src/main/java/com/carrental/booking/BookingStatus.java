package com.carrental.booking;

/**
 * Booking lifecycle. PENDING/CONFIRMED/ACTIVE are the "active" states the
 * exclusion constraint enforces against; COMPLETED/CANCELLED/EXPIRED free the
 * car's slot. Persisted as its name.
 */
public enum BookingStatus {
    PENDING,
    CONFIRMED,
    ACTIVE,
    COMPLETED,
    CANCELLED,
    EXPIRED;

    /**
     * States that occupy a car's slot (mirror of the exclusion constraint's
     * WHERE clause). A car is unavailable for a window if a booking in one of
     * these states overlaps it.
     */
    public static final java.util.Set<BookingStatus> BLOCKING =
            java.util.EnumSet.of(PENDING, CONFIRMED, ACTIVE);
}
