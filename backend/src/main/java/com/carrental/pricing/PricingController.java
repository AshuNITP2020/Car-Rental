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
 * before they commit to booking. Supplying {@code dropCity} quotes a one-way
 * trip (adds the distance-based relocation fee).
 *   GET /api/cars/{id}/quote?from=…&to=…[&dropCity=Pune]
 */
@RestController
public class PricingController {

    private final CarRepository cars;
    private final PricingService pricing;
    private final OneWayFeeService oneWayFees;

    public PricingController(CarRepository cars, PricingService pricing, OneWayFeeService oneWayFees) {
        this.cars = cars;
        this.pricing = pricing;
        this.oneWayFees = oneWayFees;
    }

    @GetMapping("/api/cars/{id}/quote")
    public PriceBreakdown quote(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) String dropCity) {
        if (!from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        Car car = cars.findByIdWithAgency(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));

        if (dropCity == null || dropCity.isBlank()) {
            return pricing.quote(car.getPricePerDay(), from, to);
        }
        String origin = car.getCurrentCity() != null ? car.getCurrentCity() : car.getAgency().getCity();
        return pricing.quote(car.getPricePerDay(), from, to, oneWayFees.feeFor(origin, dropCity));
    }
}
