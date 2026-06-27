package com.carrental.payment;

/** Lifecycle of a payment. Persisted as its name. */
public enum PaymentStatus {
    CREATED,    // order created at the provider, not yet paid
    CAPTURED,   // money successfully taken
    FAILED,
    REFUNDED
}
