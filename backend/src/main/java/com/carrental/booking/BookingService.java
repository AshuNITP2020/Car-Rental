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
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;

@Service
public class BookingService {

    private static final int MAX_OPTIMISTIC_ATTEMPTS = 3;

    private final BookingRepository bookings;
    private final CarRepository cars;
    private final UserRepository users;
    private final TransactionTemplate tx;

    @Value("${app.booking.hold-minutes:10}")
    private long holdMinutes;

    public BookingService(BookingRepository bookings, CarRepository cars, UserRepository users,
                          PlatformTransactionManager txManager) {
        this.bookings = bookings;
        this.cars = cars;
        this.users = users;
        this.tx = new TransactionTemplate(txManager);
    }

    /**
     * Creates a PENDING booking that holds the car for `holdMinutes` while the
     * user completes checkout. Correctness is guaranteed by the DB exclusion
     * constraint: we attempt the insert and translate a constraint violation
     * (someone grabbed an overlapping slot first) into a clean 409. No
     * application-level overlap check can be relied on for this — only the
     * constraint closes the race.
     */
    /**
     * Constraint-only variant: attempt the insert and let the DB exclusion
     * constraint be the sole arbiter of overlap (catch 23P01 -> 409).
     */
    @Transactional
    public BookingResponse create(Long userId, CreateBookingRequest req) {
        validateWindow(req);
        Car car = cars.findById(req.carId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
        requireAvailable(car);
        return persist(userId, car, req);
    }

    /**
     * Pessimistic-lock variant (Task #16): take a row lock on the car first, so
     * concurrent bookings for that car serialize. Holding the lock makes the
     * app-level overlap check reliable -> we can reject overlaps with a clean
     * check instead of relying on catching the constraint violation. The
     * constraint still backstops correctness.
     */
    @Transactional
    public BookingResponse createPessimistic(Long userId, CreateBookingRequest req) {
        validateWindow(req);
        Car car = cars.findByIdForUpdate(req.carId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
        requireAvailable(car);

        boolean overlap = bookings.existsByCar_IdAndStatusInAndStartTsLessThanAndEndTsGreaterThan(
                req.carId(), BookingStatus.BLOCKING, req.to(), req.from());
        if (overlap) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Already booked for an overlapping period");
        }
        return persist(userId, car, req);
    }

    /**
     * Optimistic-lock variant (Task #17): no lock is held. We force-increment
     * the car's @Version on each booking; if a concurrent booking commits first,
     * our commit fails with an optimistic-lock error and we retry in a fresh
     * transaction (where the overlap check now sees the committed booking -> 409).
     * The retry loop lives OUTSIDE the transaction — each attempt is its own
     * transaction via TransactionTemplate, so the conflict can surface and be
     * caught between attempts.
     */
    public BookingResponse createOptimistic(Long userId, CreateBookingRequest req) {
        validateWindow(req);
        for (int attempt = 1; ; attempt++) {
            try {
                return tx.execute(status -> {
                    Car car = cars.findByIdOptimistic(req.carId())   // schedules version bump
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
                    requireAvailable(car);
                    boolean overlap = bookings.existsByCar_IdAndStatusInAndStartTsLessThanAndEndTsGreaterThan(
                            req.carId(), BookingStatus.BLOCKING, req.to(), req.from());
                    if (overlap) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Already booked for an overlapping period");
                    }
                    return persist(userId, car, req);
                });
            } catch (ObjectOptimisticLockingFailureException e) {
                if (attempt >= MAX_OPTIMISTIC_ATTEMPTS) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Too much contention on this car, please retry");
                }
                // else: a concurrent booking won the version race — retry.
            }
        }
    }

    private BookingResponse persist(Long userId, Car car, CreateBookingRequest req) {
        Booking booking = new Booking();
        booking.setCar(car);
        booking.setUser(users.getReferenceById(userId));
        booking.setAgency(car.getAgency());                 // the car's owning agency
        booking.setStartTs(req.from());
        booking.setEndTs(req.to());
        booking.setStatus(BookingStatus.PENDING);
        booking.setExpiresAt(OffsetDateTime.now().plusMinutes(holdMinutes));
        booking.setAmount(estimateAmount(car, req.from(), req.to()));

        try {
            bookings.saveAndFlush(booking);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This car was just booked for an overlapping period");
        }
        return BookingResponse.from(booking);
    }

    private void validateWindow(CreateBookingRequest req) {
        if (!req.from().isBefore(req.to())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before 'to'");
        }
    }

    private void requireAvailable(Car car) {
        if (car.getStatus() != CarStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Car is not available for booking");
        }
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

    private BigDecimal estimateAmount(Car car, OffsetDateTime from, OffsetDateTime to) {
        long days = Math.max(1, (long) Math.ceil(Duration.between(from, to).toMinutes() / 1440.0));
        return car.getPricePerDay().multiply(BigDecimal.valueOf(days));
    }
}
