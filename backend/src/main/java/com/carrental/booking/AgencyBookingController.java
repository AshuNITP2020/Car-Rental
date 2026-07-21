package com.carrental.booking;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.auth.TenantContext;
import com.carrental.booking.dto.BookingResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agency-side booking lifecycle actions, scoped to the caller's agency.
 *   POST /api/agency/bookings/{id}/activate  → CONFIRMED -> ACTIVE  (car picked up)
 *   POST /api/agency/bookings/{id}/complete  → ACTIVE -> COMPLETED  (car returned)
 * Illegal transitions are rejected (409) by the state machine.
 */
@Tag(name = "Agency bookings", description = "Agency-side booking operations: list, activate (hand over keys) and complete trips")
@RestController
@RequestMapping("/api/agency/bookings")
public class AgencyBookingController {

    private final BookingService bookingService;

    public AgencyBookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/{id}/activate")
    public BookingResponse activate(@PathVariable Long id) {
        return bookingService.activateForAgency(TenantContext.requireAgencyId(), id);
    }

    @PostMapping("/{id}/complete")
    public BookingResponse complete(@PathVariable Long id) {
        return bookingService.completeForAgency(TenantContext.requireAgencyId(), id);
    }
}
