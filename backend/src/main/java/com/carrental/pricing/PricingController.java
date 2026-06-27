package com.carrental.pricing;

import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

/**
 * Customer-facing price quote for a car over a window — what they'll be charged
 * before they commit to booking.
 *   GET /api/cars/{id}/quote?from=…&to=…
 */
@RestController
public class PricingController {

    private final CarRepository cars;
    private final PricingService pricing;

    public PricingController(CarRepository cars, PricingService pricing) {
        this.cars = cars;
        this.pricing = pricing;
    }

    @GetMapping("/api/cars/{id}/quote")
    public PriceBreakdown quote(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        if (!from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        Car car = cars.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
        return pricing.quote(car.getPricePerDay(), from, to);
    }
}
