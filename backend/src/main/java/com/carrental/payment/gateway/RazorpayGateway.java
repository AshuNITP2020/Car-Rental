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

    private final String keySecret;

    private final String webhookSecret;

    public RazorpayGateway(@Value("${app.payments.razorpay.key-id}") String keyId,
                           @Value("${app.payments.razorpay.key-secret}") String keySecret,
                           @Value("${app.payments.razorpay.webhook-secret:}") String webhookSecret)
            throws RazorpayException {
        this.client = new RazorpayClient(keyId, keySecret);
        this.keySecret = keySecret;
        this.webhookSecret = webhookSecret;
    }

    /**
     * Verifies the signature Razorpay Checkout returns to the browser after a
     * successful payment: HMAC-SHA256("orderId|paymentId", key secret). This is
     * Razorpay's standard client-handshake verification, so a booking can be
     * confirmed immediately without waiting for the webhook.
     */
    @Override
    public boolean verifyCheckoutSignature(String orderId, String paymentId, String signature) {
        if (orderId == null || paymentId == null || signature == null) {
            return false;
        }
        JSONObject attributes = new JSONObject();
        attributes.put("razorpay_order_id", orderId);
        attributes.put("razorpay_payment_id", paymentId);
        attributes.put("razorpay_signature", signature);
        try {
            return Utils.verifyPaymentSignature(attributes, keySecret);
        } catch (RazorpayException e) {
            return false;
        }
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
     * + payment ids from a payment.captured / order.paid event.
     */
    @Override
    public CaptureEvent verifyAndExtractCapture(String payload, String signature) {
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
        JSONObject entity = body.getJSONObject("payload").getJSONObject("payment").getJSONObject("entity");
        return new CaptureEvent(entity.optString("order_id", null), entity.optString("id", null));
    }

    @Override
    public RefundResult refund(String paymentRef, BigDecimal amount, String currency) {
        long minorUnits = amount.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
        JSONObject request = new JSONObject();
        request.put("amount", minorUnits);
        try {
            com.razorpay.Refund refund = client.payments.refund(paymentRef, request);
            return new RefundResult(name(), refund.get("id"), amount);
        } catch (RazorpayException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Refund failed at provider: " + e.getMessage());
        }
    }

    /**
     * Razorpay Route transfer to an agency's linked account ("acc_..."). The
     * agency must be onboarded as a linked account first; without one this 502s.
     */
    @Override
    public PayoutResult payout(String linkedAccount, BigDecimal amount, String currency) {
        if (linkedAccount == null || linkedAccount.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Agency has no Razorpay linked account configured for payouts");
        }
        long minorUnits = amount.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
        JSONObject request = new JSONObject();
        request.put("account", linkedAccount);
        request.put("amount", minorUnits);
        request.put("currency", currency);
        try {
            com.razorpay.Transfer transfer = client.transfers.create(request);
            return new PayoutResult(name(), transfer.get("id"), amount);
        } catch (RazorpayException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Payout failed at provider: " + e.getMessage());
        }
    }
}
