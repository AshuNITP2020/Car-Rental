package com.carrental.pricing;

import java.math.BigDecimal;

/**
 * Itemized price for a rental window.
 *   total = rental + gst + deposit   (what the customer is charged)
 *   platformFee is the marketplace commission, deducted from the agency payout
 *   later (#25) — it is NOT added to the customer's total.
 */
public record PriceBreakdown(
        long days,
        BigDecimal rental,
        BigDecimal gst,
        BigDecimal deposit,
        BigDecimal platformFee,
        BigDecimal total,
        String currency
) {
}
