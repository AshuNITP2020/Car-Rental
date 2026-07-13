package com.carrental.booking;

import com.carrental.booking.dto.BookingResponse;
import com.carrental.booking.dto.CreateBookingRequest;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.city.CityService;
import com.carrental.events.DomainEvent;
import com.carrental.events.DomainEventPublisher;
import com.carrental.payment.PaymentService;
import com.carrental.pricing.OneWayFeeService;
import com.carrental.pricing.PriceBreakdown;
import com.carrental.pricing.PricingService;
import com.carrental.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Service
public class BookingService {

    private static final int MAX_OPTIMISTIC_ATTEMPTS = 3;

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    private final BookingRepository bookings;
    private final CarRepository cars;
    private final UserRepository users;
    private final BookingStateMachine stateMachine;
    private final PaymentService paymentService;
    private final PricingService pricing;
    private final OneWayFeeService oneWayFees;
    private final CityService cities;
    private final DomainEventPublisher events;
    private final TransactionTemplate tx;

    @Value("${app.booking.hold-minutes:10}")
    private long holdMinutes;

    public BookingService(BookingRepository bookings, CarRepository cars, UserRepository users,
                          BookingStateMachine stateMachine, PaymentService paymentService,
                          PricingService pricing, OneWayFeeService oneWayFees, CityService cities,
                          DomainEventPublisher events,
                          PlatformTransactionManager txManager) {
        this.bookings = bookings;
        this.cars = cars;
        this.users = users;
        this.stateMachine = stateMachine;
        this.paymentService = paymentService;
        this.pricing = pricing;
        this.oneWayFees = oneWayFees;
        this.cities = cities;
        this.events = events;
        this.tx = new TransactionTemplate(txManager);
    }

    /**
     * Constraint-only variant with idempotency. Correctness of
     * "no double-booking" comes from the DB exclusion constraint (catch 23P01 ->
     * 409). Idempotency: if a key is supplied and a booking already exists for
     * (user, key), return it instead of creating a second — so retries and
     * double-clicks are safe. A partial unique index backs this; a concurrent
     * same-key race is resolved by re-fetching the winner.
     */
    public BookingResponse create(Long userId, CreateBookingRequest req, String idempotencyKey) {
        validateWindow(req);
        boolean hasKey = idempotencyKey != null && !idempotencyKey.isBlank();

        if (hasKey) {
            BookingResponse existing = findByKey(userId, idempotencyKey);
            if (existing != null) {
                return existing;
            }
        }
        try {
            return tx.execute(status -> {
                Car car = cars.findById(req.carId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
                requireAvailable(car);
                return BookingResponse.from(buildAndSave(userId, car, req, hasKey ? idempotencyKey : null));
            });
        } catch (DataIntegrityViolationException e) {
            // Two possible violations: the idempotency unique index (a concurrent
            // same-key request won) or the exclusion constraint (overlap). Tell
            // them apart by re-fetching the key: if a row now exists, it's the
            // idempotency winner; otherwise it was a genuine overlap.
            if (hasKey) {
                BookingResponse winner = findByKey(userId, idempotencyKey);
                if (winner != null) {
                    return winner;
                }
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This car was just booked for an overlapping period");
        } catch (CannotAcquireLockException e) {
            // Under heavy concurrency, the exclusion-constraint check itself can
            // deadlock; Postgres aborts the victim. Exactly one booking still
            // wins — report the loser as a retryable conflict. (The pessimistic
            // and optimistic variants avoid this via ordered locking / retry.)
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Could not complete booking due to high contention, please retry");
        }
    }

    /** Reads (in its own transaction) the booking previously made with this key. */
    private BookingResponse findByKey(Long userId, String key) {
        return tx.execute(s -> bookings.findByUser_IdAndIdempotencyKey(userId, key)
                .map(BookingResponse::from).orElse(null));
    }

    /**
     * Pessimistic-lock variant: take a row lock on the car first, so
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
     * Optimistic-lock variant: no lock is held. We force-increment
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
            } catch (ObjectOptimisticLockingFailureException | CannotAcquireLockException e) {
                // version race lost, OR the exclusion check deadlocked under
                // heavy contention — both are transient, so retry in a fresh tx.
                if (attempt >= MAX_OPTIMISTIC_ATTEMPTS) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Too much contention on this car, please retry");
                }
            }
        }
    }

    /** Used by the lock variants: insert and translate a constraint hit to 409. */
    private BookingResponse persist(Long userId, Car car, CreateBookingRequest req) {
        try {
            return BookingResponse.from(buildAndSave(userId, car, req, null));
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This car was just booked for an overlapping period");
        }
    }

    /** Builds and flushes a PENDING hold. Lets DB constraint violations propagate. */
    private Booking buildAndSave(Long userId, Car car, CreateBookingRequest req, String idempotencyKey) {
        String pickupCity = car.getCurrentCity() != null ? car.getCurrentCity() : car.getAgency().getCity();
        TripType tripType = req.tripTypeOrDefault();

        // One-way: resolve (and validate) the distance-based relocation fee now,
        // so the booking stores exactly what the quote showed.
        BigDecimal oneWayFee = BigDecimal.ZERO;
        String dropCity = null;
        if (tripType == TripType.ONE_WAY) {
            oneWayFee = oneWayFees.feeFor(pickupCity, req.dropCity());
            dropCity = req.dropCity().trim();
        }

        Booking booking = new Booking();
        booking.setCar(car);
        booking.setUser(users.getReferenceById(userId));
        booking.setAgency(car.getAgency());
        booking.setStartTs(req.from());
        booking.setEndTs(req.to());
        booking.setStatus(BookingStatus.PENDING);
        booking.setExpiresAt(OffsetDateTime.now().plusMinutes(holdMinutes));
        booking.setTripType(tripType);
        booking.setPickupCity(pickupCity);
        booking.setDropCity(dropCity);
        booking.setOneWayFee(oneWayFee);
        PriceBreakdown price = pricing.quote(car.getPricePerDay(), req.from(), req.to(), oneWayFee);
        booking.setAmount(pricing.chargeableAmount(price));
        booking.setDeposit(price.deposit());
        booking.setIdempotencyKey(idempotencyKey);
        bookings.saveAndFlush(booking);
        return booking;
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

    /** Agency starts the rental: CONFIRMED -> ACTIVE. Scoped to the caller's agency. */
    @Transactional
    public BookingResponse activateForAgency(Long agencyId, Long bookingId) {
        return BookingResponse.from(transitionForAgency(agencyId, bookingId, BookingStatus.ACTIVE, null));
    }

    /** Agency closes the rental on return: ACTIVE -> COMPLETED, then pays out. */
    @Transactional
    public BookingResponse completeForAgency(Long agencyId, Long bookingId) {
        Booking booking = transitionForAgency(
                agencyId, bookingId, BookingStatus.COMPLETED, DomainEvent.BOOKING_COMPLETED);
        relocateIfOneWay(booking);
        // Payout runs in its own transaction (REQUIRES_NEW); a payout-provider
        // failure must not roll back the completion the rental already earned.
        // Production would do this async (event/outbox, Phase 4) for resilience.
        try {
            paymentService.payoutForBooking(bookingId);
        } catch (Exception e) {
            log.warn("Payout failed for booking {} (completion stands; retry later): {}",
                    bookingId, e.getMessage());
        }
        return BookingResponse.from(booking);
    }

    private Booking transitionForAgency(Long agencyId, Long bookingId,
                                        BookingStatus target, String eventType) {
        Booking booking = bookings.findByIdAndAgency_Id(bookingId, agencyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        stateMachine.transition(booking, target);
        if (eventType != null) {
            events.publish(eventType, booking);   // forwarded to Kafka after commit
        }
        return booking;
    }

    /**
     * A completed one-way trip leaves the car at the drop city: its
     * current city (and coordinates, for geo search) move there, so future
     * searches find it where it actually is.
     */
    private void relocateIfOneWay(Booking booking) {
        if (booking.getTripType() != TripType.ONE_WAY || booking.getDropCity() == null) {
            return;
        }
        Car car = booking.getCar();
        car.setCurrentCity(booking.getDropCity());
        cities.find(booking.getDropCity()).ifPresent(c -> {
            car.setLatitude(c.latitude());
            car.setLongitude(c.longitude());
        });
        log.info("One-way booking {} completed: car {} relocated to {}",
                booking.getId(), car.getId(), booking.getDropCity());
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

    // ── scheduled maintenance (#30, #31) ─────────────────────────────────────

    /**
     * #30: expire PENDING holds past their expires_at → EXPIRED, which drops
     * them out of the partial exclusion constraint and frees the car's slot.
     */
    @Transactional
    public int expireStaleHolds() {
        var stale = bookings.findByStatusAndExpiresAtBefore(BookingStatus.PENDING, OffsetDateTime.now());
        stale.forEach(b -> stateMachine.transition(b, BookingStatus.EXPIRED));
        if (!stale.isEmpty()) {
            log.info("Expired {} stale booking hold(s)", stale.size());
        }
        return stale.size();
    }

    /**
     * #31: auto-complete ACTIVE bookings whose end has passed → COMPLETED, then
     * pay out. The transition commits first (own tx), then payouts run per
     * booking (REQUIRES_NEW), so one failed payout doesn't undo any completion.
     */
    public int autoCompleteOverdue() {
        java.util.List<Long> completedIds = tx.execute(s -> {
            var overdue = bookings.findByStatusAndEndTsBefore(BookingStatus.ACTIVE, OffsetDateTime.now());
            overdue.forEach(b -> {
                stateMachine.transition(b, BookingStatus.COMPLETED);
                relocateIfOneWay(b);   // auto-completed one-ways also move the car
                events.publish(DomainEvent.BOOKING_COMPLETED, b);
            });
            return overdue.stream().map(Booking::getId).toList();
        });
        for (Long id : completedIds) {
            try {
                paymentService.payoutForBooking(id);
            } catch (Exception e) {
                log.warn("Auto-complete payout failed for booking {}: {}", id, e.getMessage());
            }
        }
        if (!completedIds.isEmpty()) {
            log.info("Auto-completed {} overdue booking(s)", completedIds.size());
        }
        return completedIds.size();
    }

    /**
     * #31: send pickup reminders for CONFIRMED bookings starting within the
     * window. Publishes BOOKING_REMINDER; the notification consumer dedupes, so
     * a user gets at most one reminder even if the job runs repeatedly.
     */
    @Transactional
    public int remindUpcomingPickups(long withinHours) {
        OffsetDateTime now = OffsetDateTime.now();
        var upcoming = bookings.findByStatusAndStartTsBetween(
                BookingStatus.CONFIRMED, now, now.plusHours(withinHours));
        upcoming.forEach(b -> events.publish(DomainEvent.BOOKING_REMINDER, b));
        return upcoming.size();
    }

    /** #31: snapshot counts for the nightly report. */
    @Transactional(readOnly = true)
    public String statusReport() {
        StringBuilder sb = new StringBuilder("Booking report:");
        for (BookingStatus st : BookingStatus.values()) {
            sb.append(' ').append(st).append('=').append(bookings.countByStatus(st));
        }
        return sb.toString();
    }
}
