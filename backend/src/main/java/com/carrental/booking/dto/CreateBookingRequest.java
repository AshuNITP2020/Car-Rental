package com.carrental.booking.dto;

import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public record CreateBookingRequest(
        @NotNull Long carId,
        @NotNull OffsetDateTime from,
        @NotNull OffsetDateTime to
) {
}
