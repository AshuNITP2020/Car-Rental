package com.carrental.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /** Existing order of a given type/status for a booking (for idempotent order creation). */
    Optional<Payment> findFirstByBooking_IdAndTypeAndStatus(Long bookingId, PaymentType type, PaymentStatus status);

    /** Look up by the provider's order/payment id (used by the webhook, #21). */
    Optional<Payment> findByProviderRef(String providerRef);
}
