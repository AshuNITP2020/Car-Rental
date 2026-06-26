package com.carrental.payment.gateway;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Local stand-in for a real payment provider — fabricates an order id, no keys
 * or network needed. Active when app.payments.provider=mock (the default). A
 * RazorpayGateway gated on provider=razorpay can be added later with no other
 * code changes.
 */
@Component
@ConditionalOnProperty(name = "app.payments.provider", havingValue = "mock", matchIfMissing = true)
public class MockPaymentGateway implements PaymentGateway {

    @Override
    public String name() {
        return "MOCK";
    }

    @Override
    public GatewayOrder createOrder(String receipt, BigDecimal amount, String currency) {
        String orderId = "order_mock_" + UUID.randomUUID().toString().replace("-", "");
        return new GatewayOrder(name(), orderId, amount, currency);
    }
}
