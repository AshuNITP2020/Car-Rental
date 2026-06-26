package com.carrental.payment.gateway;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
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

    public RazorpayGateway(@Value("${app.payments.razorpay.key-id}") String keyId,
                           @Value("${app.payments.razorpay.key-secret}") String keySecret)
            throws RazorpayException {
        this.client = new RazorpayClient(keyId, keySecret);
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
}
