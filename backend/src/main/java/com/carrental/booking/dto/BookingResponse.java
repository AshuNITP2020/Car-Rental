package com.carrental.booking.dto;

import com.carrental.booking.Booking;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record BookingResponse(
        Long id,
        Long carId,
        Long agencyId,
        Long userId,
        OffsetDateTime from,
        OffsetDateTime to,
        String status,
        BigDecimal amount,
        BigDecimal deposit,
        OffsetDateTime expiresAt
) {
    public static BookingResponse from(Booking b) {
        return new BookingResponse(
                b.getId(),
                b.getCar().getId(),
                b.getAgency().getId(),
                b.getUser().getId(),
                b.getStartTs(),
                b.getEndTs(),
                b.getStatus().name(),
                b.getAmount(),
                b.getDeposit(),
                b.getExpiresAt());
    }
}
