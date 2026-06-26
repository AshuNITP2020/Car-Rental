package com.carrental.payment;

import com.carrental.booking.Booking;
import com.carrental.booking.BookingRepository;
import com.carrental.booking.BookingStatus;
import com.carrental.payment.dto.PaymentOrderResponse;
import com.carrental.payment.gateway.PaymentGateway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

@Service
public class PaymentService {

    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final PaymentGateway gateway;

    @Value("${app.payments.currency:INR}")
    private String currency;

    public PaymentService(BookingRepository bookings, PaymentRepository payments, PaymentGateway gateway) {
        this.bookings = bookings;
        this.payments = payments;
        this.gateway = gateway;
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

    /** Rental + deposit (deposit/GST/fees get fleshed out by the pricing service, #23). */
    private BigDecimal amountToCharge(Booking booking) {
        BigDecimal amount = booking.getAmount() != null ? booking.getAmount() : BigDecimal.ZERO;
        BigDecimal deposit = booking.getDeposit() != null ? booking.getDeposit() : BigDecimal.ZERO;
        return amount.add(deposit);
    }
}
