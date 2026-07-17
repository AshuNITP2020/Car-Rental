package com.carrental.events;

import java.math.BigDecimal;

/**
 * A domain event published when something notable happens to a booking. Used
 * both as the in-process Spring event and (serialized to JSON) as the Kafka
 * message. Consumers react by `type`.
 */
public record DomainEvent(
        String type,
        Long bookingId,
        Long userId,
        Long agencyId,
        Long carId,
        BigDecimal amount,
        String occurredAt
) {
    public static final String PAYMENT_CAPTURED = "PAYMENT_CAPTURED";
    public static final String BOOKING_CONFIRMED = "BOOKING_CONFIRMED";
    public static final String BOOKING_CANCELLED = "BOOKING_CANCELLED";
    public static final String BOOKING_COMPLETED = "BOOKING_COMPLETED";
    public static final String BOOKING_REMINDER = "BOOKING_REMINDER";
}
