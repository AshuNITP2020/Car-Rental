package com.carrental.payment;

import com.carrental.auth.AuthPrincipal;
import com.carrental.payment.dto.PaymentOrderResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Creates the payment order a customer uses to pay for their booking.
 *   POST /api/bookings/{bookingId}/payment
 */
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
}
