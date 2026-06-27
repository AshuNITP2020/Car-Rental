package com.carrental.payment;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public endpoint the payment provider calls when a payment succeeds. Not
 * JWT-authenticated (the caller is the provider, not a user) — authenticity is
 * established by the signature, verified inside the active gateway.
 *   POST /api/payments/webhook
 */
@RestController
public class PaymentWebhookController {

    private final PaymentService paymentService;

    public PaymentWebhookController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/api/payments/webhook")
    public ResponseEntity<Void> webhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String razorpaySignature,
            @RequestHeader(value = "X-Webhook-Signature", required = false) String mockSignature) {
        String signature = razorpaySignature != null ? razorpaySignature : mockSignature;
        paymentService.handleCaptureWebhook(payload, signature);
        return ResponseEntity.ok().build();
    }
}
