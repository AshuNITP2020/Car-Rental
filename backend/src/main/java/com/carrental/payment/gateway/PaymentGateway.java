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

    /**
     * Verifies a webhook's authenticity (signature/secret) and, if it's a
     * successful-payment event, returns the captured order + payment ids.
     * Returns null for events we don't act on; throws 401 if verification fails.
     */
    CaptureEvent verifyAndExtractCapture(String payload, String signature);

    /** Refunds (part of) a captured payment. paymentRef is the provider PAYMENT id. */
    RefundResult refund(String paymentRef, BigDecimal amount, String currency);

    /**
     * Pays out to an agency's linked account (marketplace split). linkedAccount
     * is the provider's account id (Razorpay Route "acc_..."); the mock ignores it.
     */
    PayoutResult payout(String linkedAccount, BigDecimal amount, String currency);

    record GatewayOrder(String provider, String orderId, BigDecimal amount, String currency) {
    }

    record CaptureEvent(String orderId, String paymentId) {
    }

    record RefundResult(String provider, String refundId, BigDecimal amount) {
    }

    record PayoutResult(String provider, String payoutId, BigDecimal amount) {
    }
}
