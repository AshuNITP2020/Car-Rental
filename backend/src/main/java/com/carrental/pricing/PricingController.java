package com.carrental.pricing;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
 * before they commit to booking. Supplying a drop pin ({@code dropLat}/{@code
 * dropLng}) quotes a one-way trip (adds the distance-based relocation fee).
 *   GET /api/cars/{id}/quote?from=…&to=…[&dropLat=18.52&dropLng=73.85]
 */
@Tag(name = "Pricing", description = "Price quotes for a car and window; adding a drop point quotes a one-way trip with its relocation fee")
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

    @Operation(summary = "Price quote for a car and window",
            description = "dropLat/dropLng quotes a ONE-WAY trip: adds a distance-based relocation fee; the drop must be inside the car's own agency area.")
    @GetMapping("/api/cars/{id}/quote")
    public PriceBreakdown quote(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) Double dropLat,
            @RequestParam(required = false) Double dropLng) {
        if (!from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        if ((dropLat == null) != (dropLng == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide both 'dropLat' and 'dropLng', or neither");
        }
        Car car = cars.findByIdWithAgency(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));

        if (dropLat == null) {
            return pricing.quote(car.getPricePerDay(), from, to);
        }
        Double originLat = car.getLatitude() != null ? car.getLatitude() : car.getAgency().getLatitude();
        Double originLng = car.getLongitude() != null ? car.getLongitude() : car.getAgency().getLongitude();
        return pricing.quote(car.getPricePerDay(), from, to,
                oneWayFees.feeFor(car.getAgency().getId(), originLat, originLng, dropLat, dropLng));
    }
}
