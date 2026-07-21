package com.carrental.payment;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.auth.AuthPrincipal;
import com.carrental.payment.dto.PaymentOrderResponse;
import com.carrental.payment.dto.VerifyCheckoutRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Creates the payment order a customer uses to pay for their booking.
 *   POST /api/bookings/{bookingId}/payment
 */
@Tag(name = "Payments", description = "Checkout + verification for a booking (Razorpay or the dev mock provider)")
@RestController
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/api/bookings/{bookingId}/payment")
    public PaymentOrderResponse createOrder(@AuthenticationPrincipal AuthPrincipal principal,
                                            @PathVariable Long bookingId) {
        return paymentService.createOrder(principal.userId(), bookingId);
    }

    /**
     * Razorpay checkout handshake: the browser posts back the ids + signature
     * from the checkout widget; we verify the signature server-side, capture
     * the payment and confirm the booking (no webhook round-trip needed).
     *   POST /api/bookings/{bookingId}/payment/verify
     */
    @PostMapping("/api/bookings/{bookingId}/payment/verify")
    public PaymentOrderResponse verifyCheckout(@AuthenticationPrincipal AuthPrincipal principal,
                                               @PathVariable Long bookingId,
                                               @Valid @RequestBody VerifyCheckoutRequest req) {
        return paymentService.verifyCheckout(principal.userId(), bookingId,
                req.razorpayOrderId(), req.razorpayPaymentId(), req.razorpaySignature());
    }

    /**
     * Dev-only mock payment capture (default mock provider). Confirms the
     * caller's pending booking without a hosted checkout page. 400 when a real
     * provider is configured.
     *   POST /api/bookings/{bookingId}/payment/mock-capture
     */
    @PostMapping("/api/bookings/{bookingId}/payment/mock-capture")
    public PaymentOrderResponse mockCapture(@AuthenticationPrincipal AuthPrincipal principal,
                                            @PathVariable Long bookingId) {
        return paymentService.mockCapture(principal.userId(), bookingId);
    }
}
