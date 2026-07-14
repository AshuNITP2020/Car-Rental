package com.carrental.payment.dto;

import com.carrental.payment.Payment;

import java.math.BigDecimal;

/**
 * What the client needs to open the provider's checkout for this booking.
 * {@code keyId} is the provider's PUBLIC key id (Razorpay key_id) that the
 * browser checkout widget needs; null for the mock provider. Never the secret.
 */
public record PaymentOrderResponse(
        Long paymentId,
        Long bookingId,
        String provider,
        String orderId,
        BigDecimal amount,
        String currency,
        String status,
        String keyId
) {
    public static PaymentOrderResponse from(Payment p, String currency, String keyId) {
        return new PaymentOrderResponse(
                p.getId(),
                p.getBooking().getId(),
                p.getProvider(),
                p.getProviderRef(),
                p.getAmount(),
                currency,
                p.getStatus().name(),
                keyId);
    }
}
