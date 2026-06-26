package com.carrental.payment.gateway;

import java.math.BigDecimal;

/**
 * Abstraction over the payment provider. The mock impl runs locally with no
 * keys; a RazorpayGateway can be added later behind config without touching
 * the booking/payment services.
 */
public interface PaymentGateway {

    /** Provider name stored on the payment row (e.g. "MOCK", "RAZORPAY"). */
    String name();

    /** Creates a payment order at the provider and returns its identifiers. */
    GatewayOrder createOrder(String receipt, BigDecimal amount, String currency);

    record GatewayOrder(String provider, String orderId, BigDecimal amount, String currency) {
    }
}
