package com.carrental.payment.gateway;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Real Razorpay provider. Active only when app.payments.provider=razorpay, so
 * the default mock path needs no keys or network. Set RAZORPAY_KEY_ID /
 * RAZORPAY_KEY_SECRET (test-mode keys) to use it.
 */
@Component
@ConditionalOnProperty(name = "app.payments.provider", havingValue = "razorpay")
public class RazorpayGateway implements PaymentGateway {

    private final RazorpayClient client;

    private final String webhookSecret;

    public RazorpayGateway(@Value("${app.payments.razorpay.key-id}") String keyId,
                           @Value("${app.payments.razorpay.key-secret}") String keySecret,
                           @Value("${app.payments.razorpay.webhook-secret:}") String webhookSecret)
            throws RazorpayException {
        this.client = new RazorpayClient(keyId, keySecret);
        this.webhookSecret = webhookSecret;
    }

    @Override
    public String name() {
        return "RAZORPAY";
    }

    @Override
    public GatewayOrder createOrder(String receipt, BigDecimal amount, String currency) {
        // Razorpay expects the amount in the smallest unit (paise for INR).
        long minorUnits = amount.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
        JSONObject request = new JSONObject();
        request.put("amount", minorUnits);
        request.put("currency", currency);
        request.put("receipt", receipt);
        try {
            Order order = client.orders.create(request);
            return new GatewayOrder(name(), order.get("id"), amount, currency);
        } catch (RazorpayException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Payment provider error: " + e.getMessage());
        }
    }

    /**
     * Verifies the X-Razorpay-Signature HMAC, then extracts the captured order
     * id from a payment.captured / order.paid event.
     */
    @Override
    public String verifyAndExtractCapturedOrderId(String payload, String signature) {
        try {
            if (signature == null || !Utils.verifyWebhookSignature(payload, signature, webhookSecret)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook signature");
            }
        } catch (RazorpayException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Webhook signature check failed");
        }
        JSONObject body = new JSONObject(payload);
        String event = body.optString("event");
        if (!"payment.captured".equals(event) && !"order.paid".equals(event)) {
            return null;
        }
        return body.getJSONObject("payload").getJSONObject("payment")
                .getJSONObject("entity").optString("order_id", null);
    }
}
