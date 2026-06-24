package com.carrental.booking;

import com.carrental.auth.AuthPrincipal;
import com.carrental.booking.dto.BookingResponse;
import com.carrental.booking.dto.CreateBookingRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Customer-facing booking endpoints. A booking is always created for the
 * authenticated user; reads are scoped to that user.
 */
@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    public ResponseEntity<BookingResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                                  @Valid @RequestBody CreateBookingRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.create(principal.userId(), req));
    }

    @PostMapping("/pessimistic")
    public ResponseEntity<BookingResponse> createPessimistic(@AuthenticationPrincipal AuthPrincipal principal,
                                                             @Valid @RequestBody CreateBookingRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.createPessimistic(principal.userId(), req));
    }

    @PostMapping("/optimistic")
    public ResponseEntity<BookingResponse> createOptimistic(@AuthenticationPrincipal AuthPrincipal principal,
                                                            @Valid @RequestBody CreateBookingRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.createOptimistic(principal.userId(), req));
    }

    @GetMapping
    public List<BookingResponse> myBookings(@AuthenticationPrincipal AuthPrincipal principal) {
        return bookingService.listForUser(principal.userId());
    }

    @GetMapping("/{id}")
    public BookingResponse get(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable Long id) {
        return bookingService.getForUser(principal.userId(), id);
    }
}
