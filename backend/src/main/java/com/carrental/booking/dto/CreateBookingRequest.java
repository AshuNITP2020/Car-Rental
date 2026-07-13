package com.carrental.booking.dto;

import com.carrental.booking.TripType;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

/**
 * A booking request. {@code tripType} defaults to ROUND_TRIP when omitted;
 * ONE_WAY requires a {@code dropCity} different from the car's pickup city.
 */
public record CreateBookingRequest(
        @NotNull Long carId,
        @NotNull OffsetDateTime from,
        @NotNull OffsetDateTime to,
        TripType tripType,
        String dropCity
) {
    public TripType tripTypeOrDefault() {
        return tripType != null ? tripType : TripType.ROUND_TRIP;
    }
}
