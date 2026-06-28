package com.carrental.payment;

import com.carrental.booking.Booking;
import com.carrental.booking.BookingRepository;
import com.carrental.booking.BookingStateMachine;
import com.carrental.booking.BookingStatus;
import com.carrental.events.DomainEvent;
import com.carrental.events.DomainEventPublisher;
import com.carrental.payment.dto.PaymentOrderResponse;
import com.carrental.payment.gateway.PaymentGateway;
import com.carrental.pricing.PriceBreakdown;
import com.carrental.pricing.PricingService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class PaymentService {

    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final PaymentGateway gateway;
    private final BookingStateMachine stateMachine;
    private final PricingService pricing;
    private final DomainEventPublisher events;

    @Value("${app.payments.currency:INR}")
    private String currency;

    public PaymentService(BookingRepository bookings, PaymentRepository payments,
                          PaymentGateway gateway, BookingStateMachine stateMachine,
                          PricingService pricing, DomainEventPublisher events) {
        this.bookings = bookings;
        this.payments = payments;
        this.gateway = gateway;
        this.stateMachine = stateMachine;
        this.pricing = pricing;
        this.events = events;
    }

    /**
     * Creates (or returns the existing) payment order for the caller's pending
     * booking. Idempotent per booking: a second call returns the same order
     * rather than creating another.
     */
    @Transactional
    public PaymentOrderResponse createOrder(Long userId, Long bookingId) {
        Booking booking = bookings.findByIdAndUser_Id(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Booking is not awaiting payment");
        }

        var existing = payments.findFirstByBooking_IdAndTypeAndStatus(
                bookingId, PaymentType.BOOKING, PaymentStatus.CREATED);
        if (existing.isPresent()) {
            return PaymentOrderResponse.from(existing.get(), currency);
        }

        BigDecimal amount = amountToCharge(booking);
        PaymentGateway.GatewayOrder order = gateway.createOrder("booking-" + bookingId, amount, currency);

        Payment payment = new Payment();
        payment.setBooking(booking);
        payment.setType(PaymentType.BOOKING);
        payment.setAmount(amount);
        payment.setStatus(PaymentStatus.CREATED);
        payment.setProvider(order.provider());
        payment.setProviderRef(order.orderId());
        payments.save(payment);

        return PaymentOrderResponse.from(payment, currency);
    }

    /**
     * Processes a provider webhook. Verifies it, then on a successful capture
     * marks the payment CAPTURED and confirms the booking. Idempotent: a
     * re-delivered webhook for an already-captured payment is a no-op, so the
     * provider can safely retry.
     */
    @Transactional
    public void handleCaptureWebhook(String payload, String signature) {
        PaymentGateway.CaptureEvent event = gateway.verifyAndExtractCapture(payload, signature);
        if (event == null || event.orderId() == null) {
            return;
        }
        Payment payment = payments.findByProviderRef(event.orderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown payment order"));

        if (payment.getStatus() == PaymentStatus.CAPTURED) {
            return;
        }
        payment.setStatus(PaymentStatus.CAPTURED);
        payment.setCapturedRef(event.paymentId());   // provider payment id, for refunds (#24)

        Booking booking = payment.getBooking();
        events.publish(DomainEvent.PAYMENT_CAPTURED, booking);
        if (booking.getStatus() == BookingStatus.PENDING) {
            stateMachine.transition(booking, BookingStatus.CONFIRMED);
            events.publish(DomainEvent.BOOKING_CONFIRMED, booking);
        }
    }

    /**
     * Refunds a captured booking payment and records a REFUND ledger row.
     * Returns the refund id. Caller decides the amount (cancellation policy).
     */
    @Transactional
    public String refundBookingPayment(Booking booking, BigDecimal amount) {
        Payment captured = payments.findFirstByBooking_IdAndTypeAndStatus(
                        booking.getId(), PaymentType.BOOKING, PaymentStatus.CAPTURED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "No captured payment to refund for this booking"));

        String reference = captured.getCapturedRef() != null ? captured.getCapturedRef() : captured.getProviderRef();
        PaymentGateway.RefundResult result = gateway.refund(reference, amount, currency);

        captured.setStatus(PaymentStatus.REFUNDED);

        Payment refund = new Payment();
        refund.setBooking(booking);
        refund.setType(PaymentType.REFUND);
        refund.setAmount(amount);
        refund.setStatus(PaymentStatus.CAPTURED);   // the refund itself completed
        refund.setProvider(result.provider());
        refund.setProviderRef(result.refundId());
        payments.save(refund);
        return result.refundId();
    }

    /**
     * Marketplace payout on booking completion (Task #25): split the captured
     * booking charge — platform keeps its commission, the agency receives the
     * rest, transferred to its linked account. Idempotent: at most one PAYOUT
     * per booking. Returns the payout id, or null if nothing to pay out.
     *
     * Runs in its OWN transaction (REQUIRES_NEW) so a payout-provider failure
     * doesn't roll back the booking completion that triggered it; the caller
     * catches and logs. Re-loads the booking by id to stay within this tx.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String payoutForBooking(Long bookingId) {
        if (payments.existsByBooking_IdAndType(bookingId, PaymentType.PAYOUT)) {
            return null;
        }

        var captured = payments.findFirstByBooking_IdAndTypeAndStatus(
                bookingId, PaymentType.BOOKING, PaymentStatus.CAPTURED);
        if (captured.isEmpty()) {
            return null;
        }
        Booking booking = bookings.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        // Split the RENTAL only — GST is tax (remitted separately) and the
        // deposit is the customer's refundable money, neither is agency revenue.
        // Recompute the breakdown from pricing (single source of the fee math).
        PriceBreakdown price = pricing.quote(
                booking.getCar().getPricePerDay(), booking.getStartTs(), booking.getEndTs());
        BigDecimal agencyAmount = price.rental().subtract(price.platformFee())
                .setScale(2, RoundingMode.HALF_UP);
        if (agencyAmount.signum() <= 0) {
            return null;
        }

        String linkedAccount = booking.getAgency().getPayoutAccount();
        PaymentGateway.PayoutResult result = gateway.payout(linkedAccount, agencyAmount, currency);

        Payment payout = new Payment();
        payout.setBooking(booking);
        payout.setType(PaymentType.PAYOUT);
        payout.setAmount(agencyAmount);
        payout.setStatus(PaymentStatus.CAPTURED);   // the transfer completed
        payout.setProvider(result.provider());
        payout.setProviderRef(result.payoutId());
        payments.save(payout);
        return result.payoutId();
    }

    /** Rental + deposit. */
    private BigDecimal amountToCharge(Booking booking) {
        BigDecimal amount = booking.getAmount() != null ? booking.getAmount() : BigDecimal.ZERO;
        BigDecimal deposit = booking.getDeposit() != null ? booking.getDeposit() : BigDecimal.ZERO;
        return amount.add(deposit);
    }
}
