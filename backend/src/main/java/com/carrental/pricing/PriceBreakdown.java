package com.carrental.pricing;

import java.math.BigDecimal;

/**
 * Itemized price for a rental window.
 *   total = rental + gst + deposit + oneWayFee   (what the customer is charged)
 *   oneWayFee is the distance-based relocation fee for one-way drop-offs
 *   (zero for round trips).
 *   platformFee is the marketplace commission, deducted from the agency payout
 *   later (#25) — it is NOT added to the customer's total.
 */
public record PriceBreakdown(
        long days,
        BigDecimal rental,
        BigDecimal gst,
        BigDecimal deposit,
        BigDecimal oneWayFee,
        BigDecimal platformFee,
        BigDecimal total,
        String currency
) {
}
