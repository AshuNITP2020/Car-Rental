package com.carrental.booking;

import com.carrental.booking.dto.AvailabilityResponse;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

@Service
public class AvailabilityService {

    private final CarRepository cars;
    private final BookingRepository bookings;

    public AvailabilityService(CarRepository cars, BookingRepository bookings) {
        this.cars = cars;
        this.bookings = bookings;
    }

    /** Customer-facing: can this car be booked for [from, to)? */
    @Transactional(readOnly = true)
    public AvailabilityResponse check(Long carId, OffsetDateTime from, OffsetDateTime to) {
        Car car = cars.findById(carId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));

        if (car.getStatus() != CarStatus.AVAILABLE) {
            return AvailabilityResponse.taken(carId, from, to, "Car is not available for booking");
        }
        boolean overlap = bookings.existsByCar_IdAndStatusInAndStartTsLessThanAndEndTsGreaterThan(
                carId, BookingStatus.BLOCKING, to, from);
        return overlap
                ? AvailabilityResponse.taken(carId, from, to, "Already booked for an overlapping period")
                : AvailabilityResponse.free(carId, from, to);
    }
}
