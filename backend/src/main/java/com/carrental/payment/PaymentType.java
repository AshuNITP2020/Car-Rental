package com.carrental.payment;

/** What a payment is for. Persisted as its name. */
public enum PaymentType {
    BOOKING,   // the rental charge
    DEPOSIT,   // refundable security deposit
    REFUND,    // money returned to the customer
    PAYOUT     // money paid out to the agency
}
