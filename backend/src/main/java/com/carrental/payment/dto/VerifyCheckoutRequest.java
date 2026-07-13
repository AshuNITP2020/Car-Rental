package com.carrental.payment.dto;

import jakarta.validation.constraints.NotBlank;

/** What Razorpay Checkout hands the browser after a successful payment. */
public record VerifyCheckoutRequest(
        @NotBlank String razorpayOrderId,
        @NotBlank String razorpayPaymentId,
        @NotBlank String razorpaySignature
) {
}
