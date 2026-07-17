package com.carrental.pricing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Computes the itemized price for a rental. Single source of truth for amounts,
 * so the quote endpoint, booking creation, and the payment order all agree.
 */
@Service
public class PricingService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final BigDecimal gstPercent;
    private final BigDecimal depositPercent;
    private final BigDecimal platformFeePercent;
    private final BigDecimal oneWayPerKm;
    private final String currency;

    public PricingService(
            @Value("${app.pricing.gst-percent:18}") BigDecimal gstPercent,
            @Value("${app.pricing.deposit-percent:20}") BigDecimal depositPercent,
            @Value("${app.pricing.platform-fee-percent:10}") BigDecimal platformFeePercent,
            @Value("${app.pricing.one-way-per-km:12}") BigDecimal oneWayPerKm,
            @Value("${app.payments.currency:INR}") String currency) {
        this.gstPercent = gstPercent;
        this.depositPercent = depositPercent;
        this.platformFeePercent = platformFeePercent;
        this.oneWayPerKm = oneWayPerKm;
        this.currency = currency;
    }

    /** Round-trip quote (no relocation fee). */
    public PriceBreakdown quote(BigDecimal pricePerDay, OffsetDateTime from, OffsetDateTime to) {
        return quote(pricePerDay, from, to, BigDecimal.ZERO);
    }

    /** Quote including a one-way relocation fee (0 for round trips). */
    public PriceBreakdown quote(BigDecimal pricePerDay, OffsetDateTime from, OffsetDateTime to,
                                BigDecimal oneWayFee) {
        long days = Math.max(1, (long) Math.ceil(Duration.between(from, to).toMinutes() / 1440.0));
        BigDecimal rental = money(pricePerDay.multiply(BigDecimal.valueOf(days)));
        BigDecimal gst = percentOf(rental, gstPercent);
        BigDecimal deposit = percentOf(rental, depositPercent);
        BigDecimal platformFee = percentOf(rental, platformFeePercent);
        BigDecimal fee = money(oneWayFee == null ? BigDecimal.ZERO : oneWayFee);
        BigDecimal total = money(rental.add(gst).add(deposit).add(fee));
        return new PriceBreakdown(days, rental, gst, deposit, fee, platformFee, total, currency);
    }

    /** The distance-based relocation fee for a one-way drop-off. */
    public BigDecimal oneWayFeeFor(double distanceKm) {
        return money(oneWayPerKm.multiply(BigDecimal.valueOf(distanceKm)));
    }

    /** The non-refundable amount charged on the booking (rental + GST). */
    public BigDecimal chargeableAmount(PriceBreakdown priceBreakdown) {
        return money(priceBreakdown.rental().add(priceBreakdown.gst()));
    }

    private BigDecimal percentOf(BigDecimal base, BigDecimal percent) {
        return money(base.multiply(percent).divide(HUNDRED, 4, RoundingMode.HALF_UP));
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
