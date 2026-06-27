package com.carrental.booking;

import com.carrental.booking.dto.CancelResponse;
import com.carrental.payment.PaymentService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;

/**
 * Customer-initiated cancellation with refund. Coordinates the booking state
 * transition (PENDING/CONFIRMED -> CANCELLED) with a refund through the payment
 * gateway, in one transaction.
 *
 * Refund policy:
 *   - PENDING (nothing captured): no refund.
 *   - CONFIRMED (payment captured): deposit refunded in full; rental refunded
 *     fully if cancelled >= freeWindowHours before start, else lateRefundPercent.
 */
@Service
public class CancellationService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final BookingRepository bookings;
    private final BookingStateMachine stateMachine;
    private final PaymentService payments;

    @Value("${app.cancellation.free-window-hours:24}")
    private long freeWindowHours;
    @Value("${app.cancellation.late-refund-percent:50}")
    private BigDecimal lateRefundPercent;
    @Value("${app.payments.currency:INR}")
    private String currency;

    public CancellationService(BookingRepository bookings, BookingStateMachine stateMachine,
                               PaymentService payments) {
        this.bookings = bookings;
        this.stateMachine = stateMachine;
        this.payments = payments;
    }

    @Transactional
    public CancelResponse cancelForUser(Long userId, Long bookingId) {
        Booking booking = bookings.findByIdAndUser_Id(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        BookingStatus previous = booking.getStatus();
        stateMachine.transition(booking, BookingStatus.CANCELLED);

        BigDecimal refunded = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (previous == BookingStatus.CONFIRMED) {
            refunded = computeRefund(booking);
            payments.refundBookingPayment(booking, refunded);
        }
        return new CancelResponse(booking.getId(), booking.getStatus().name(), refunded, currency);
    }

    private BigDecimal computeRefund(Booking booking) {
        BigDecimal amount = nz(booking.getAmount());
        BigDecimal deposit = nz(booking.getDeposit());
        boolean late = OffsetDateTime.now().isAfter(booking.getStartTs().minusHours(freeWindowHours));
        BigDecimal rentalRefund = late
                ? amount.multiply(lateRefundPercent).divide(HUNDRED, 2, RoundingMode.HALF_UP)
                : amount;
        return rentalRefund.add(deposit).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
