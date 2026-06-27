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
    private final String currency;

    public PricingService(
            @Value("${app.pricing.gst-percent:18}") BigDecimal gstPercent,
            @Value("${app.pricing.deposit-percent:20}") BigDecimal depositPercent,
            @Value("${app.pricing.platform-fee-percent:10}") BigDecimal platformFeePercent,
            @Value("${app.payments.currency:INR}") String currency) {
        this.gstPercent = gstPercent;
        this.depositPercent = depositPercent;
        this.platformFeePercent = platformFeePercent;
        this.currency = currency;
    }

    public PriceBreakdown quote(BigDecimal pricePerDay, OffsetDateTime from, OffsetDateTime to) {
        long days = Math.max(1, (long) Math.ceil(Duration.between(from, to).toMinutes() / 1440.0));
        BigDecimal rental = money(pricePerDay.multiply(BigDecimal.valueOf(days)));
        BigDecimal gst = percentOf(rental, gstPercent);
        BigDecimal deposit = percentOf(rental, depositPercent);
        BigDecimal platformFee = percentOf(rental, platformFeePercent);
        BigDecimal total = money(rental.add(gst).add(deposit));
        return new PriceBreakdown(days, rental, gst, deposit, platformFee, total, currency);
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
