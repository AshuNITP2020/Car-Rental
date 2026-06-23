package com.carrental.booking;

import com.carrental.booking.dto.BookingResponse;
import com.carrental.booking.dto.CreateBookingRequest;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;

@Service
public class BookingService {

    private final BookingRepository bookings;
    private final CarRepository cars;
    private final UserRepository users;

    @Value("${app.booking.hold-minutes:10}")
    private long holdMinutes;

    public BookingService(BookingRepository bookings, CarRepository cars, UserRepository users) {
        this.bookings = bookings;
        this.cars = cars;
        this.users = users;
    }

    /**
     * Creates a PENDING booking that holds the car for `holdMinutes` while the
     * user completes checkout. Correctness is guaranteed by the DB exclusion
     * constraint: we attempt the insert and translate a constraint violation
     * (someone grabbed an overlapping slot first) into a clean 409. No
     * application-level overlap check can be relied on for this — only the
     * constraint closes the race.
     */
    @Transactional
    public BookingResponse create(Long userId, CreateBookingRequest req) {
        if (!req.from().isBefore(req.to())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
        Car car = cars.findById(req.carId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
        if (car.getStatus() != CarStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Car is not available for booking");
        }

        Booking booking = new Booking();
        booking.setCar(car);
        booking.setUser(users.getReferenceById(userId));
        booking.setAgency(car.getAgency());                 // the car's owning agency
        booking.setStartTs(req.from());
        booking.setEndTs(req.to());
        booking.setStatus(BookingStatus.PENDING);
        booking.setExpiresAt(OffsetDateTime.now().plusMinutes(holdMinutes));
        booking.setAmount(estimateAmount(car, req.from(), req.to()));  // full pricing in #23

        try {
            bookings.saveAndFlush(booking);  // flush now so 23P01 surfaces here
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This car was just booked for an overlapping period");
        }
        return BookingResponse.from(booking);
    }

    @Transactional(readOnly = true)
    public BookingResponse getForUser(Long userId, Long bookingId) {
        return bookings.findByIdAndUser_Id(bookingId, userId)
                .map(BookingResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    @Transactional(readOnly = true)
    public java.util.List<BookingResponse> listForUser(Long userId) {
        return bookings.findByUser_IdOrderByStartTsDesc(userId).stream().map(BookingResponse::from).toList();
    }

    /** Simple line total = whole days (rounded up, min 1) × price/day. */
    private BigDecimal estimateAmount(Car car, OffsetDateTime from, OffsetDateTime to) {
        long days = Math.max(1, (long) Math.ceil(Duration.between(from, to).toMinutes() / 1440.0));
        return car.getPricePerDay().multiply(BigDecimal.valueOf(days));
    }
}
