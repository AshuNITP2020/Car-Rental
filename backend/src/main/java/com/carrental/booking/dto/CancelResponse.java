package com.carrental.booking.dto;

import java.math.BigDecimal;

public record CancelResponse(
        Long bookingId,
        String status,
        BigDecimal refundedAmount,
        String currency
) {
}
