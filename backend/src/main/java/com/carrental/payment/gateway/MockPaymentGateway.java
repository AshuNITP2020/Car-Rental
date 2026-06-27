package com.carrental.payment.gateway;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

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

    @Value("${app.payments.webhook-secret:dev-webhook-secret}")
    private String webhookSecret;

    @Override
    public String name() {
        return "MOCK";
    }

    @Override
    public GatewayOrder createOrder(String receipt, BigDecimal amount, String currency) {
        String orderId = "order_mock_" + UUID.randomUUID().toString().replace("-", "");
        return new GatewayOrder(name(), orderId, amount, currency);
    }

    /**
     * Mock "signature" is just a shared secret in the X-Webhook-Signature header.
     * Body: {"event":"captured","orderId":"order_mock_..."}.
     */
    @Override
    public String verifyAndExtractCapturedOrderId(String payload, String signature) {
        if (signature == null || !signature.equals(webhookSecret)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook signature");
        }
        JSONObject body = new JSONObject(payload);
        if (!"captured".equals(body.optString("event"))) {
            return null;   // not a capture event — ignore
        }
        String orderId = body.optString("orderId", null);
        return (orderId == null || orderId.isBlank()) ? null : orderId;
    }
}
