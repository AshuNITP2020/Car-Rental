package com.carrental.booking;

import com.carrental.booking.dto.AvailabilityResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

/**
 * Customer-facing availability check (cross-tenant: any car, any agency).
 *   GET /api/cars/{id}/availability?from=2026-06-21T10:00:00Z&to=2026-06-24T10:00:00Z
 */
@RestController
public class CarAvailabilityController {

    private final AvailabilityService availability;

    public CarAvailabilityController(AvailabilityService availability) {
        this.availability = availability;
    }

    @GetMapping("/api/cars/{id}/availability")
    public AvailabilityResponse availability(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {

        if (!from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        return availability.check(id, from, to);
    }
}
