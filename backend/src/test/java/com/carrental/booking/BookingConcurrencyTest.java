package com.carrental.booking;

import com.carrental.agency.Agency;
import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyStatus;
import com.carrental.booking.dto.BookingResponse;
import com.carrental.booking.dto.CreateBookingRequest;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The crown-jewel proof: when N requests try to book the SAME car for the SAME
 * overlapping window at the same instant, EXACTLY ONE succeeds — for every
 * concurrency strategy. Runs against the real (dev) Postgres so the exclusion
 * constraint and row/version locks actually execute.
 */
@SpringBootTest(
        // MOCK web env provides HttpSecurity for SecurityConfig (no real server).
        // Size the pool so all 50 worker threads can hold a connection at once.
        properties = "spring.datasource.hikari.maximum-pool-size=60")
class BookingConcurrencyTest {

    private static final int THREADS = 50;

    @Autowired BookingService bookingService;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;
    @Autowired BookingRepository bookings;

    private Long userId;
    private CreateBookingRequest sameWindowRequest;

    @BeforeEach
    void seedFreshCar() {
        // Committed setup (no @Transactional on the test) so the worker threads,
        // in their own transactions, can see the user/agency/car.
        User u = new User();
        u.setName("Concurrent Tester");
        u.setEmail("conc-" + UUID.randomUUID() + "@test.local");
        u.setPasswordHash("x");
        users.save(u);
        userId = u.getId();

        Agency a = new Agency();
        a.setName("Test Agency");
        a.setOwner(u);
        a.setStatus(AgencyStatus.ACTIVE);
        agencies.save(a);

        Car c = new Car();
        c.setAgency(a);
        c.setMake("Test");
        c.setModel("Car");
        c.setCategory("SUV");
        c.setRegNo("REG-" + UUID.randomUUID().toString().substring(0, 8));
        c.setPricePerDay(new BigDecimal("1000"));
        c.setStatus(CarStatus.AVAILABLE);
        cars.save(c);

        sameWindowRequest = new CreateBookingRequest(
                c.getId(),
                OffsetDateTime.parse("2026-06-21T10:00:00Z"),
                OffsetDateTime.parse("2026-06-24T10:00:00Z"),
                null, null);
    }

    @Test
    void constraintOnly_exactlyOneWins() throws Exception {
        assertExactlyOneWins((uid, req) -> bookingService.create(uid, req, null));
    }

    @Test
    void pessimistic_exactlyOneWins() throws Exception {
        assertExactlyOneWins(bookingService::createPessimistic);
    }

    @Test
    void optimistic_exactlyOneWins() throws Exception {
        assertExactlyOneWins(bookingService::createOptimistic);
    }

    private void assertExactlyOneWins(BiFunction<Long, CreateBookingRequest, BookingResponse> createFn)
            throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch fireAtOnce = new CountDownLatch(1);
        CountDownLatch finished = new CountDownLatch(THREADS);
        AtomicInteger successes = new AtomicInteger();
        AtomicInteger conflicts = new AtomicInteger();   // 409s (overlap / contention)
        AtomicInteger unexpected = new AtomicInteger();
        java.util.concurrent.atomic.AtomicReference<Throwable> sample = new java.util.concurrent.atomic.AtomicReference<>();

        for (int i = 0; i < THREADS; i++) {
            pool.submit(() -> {
                try {
                    fireAtOnce.await();                 // all threads block here...
                    createFn.apply(userId, sameWindowRequest);  // ...then race together
                    successes.incrementAndGet();
                } catch (ResponseStatusException e) {
                    if (e.getStatusCode().value() == 409) {
                        conflicts.incrementAndGet();
                    } else {
                        unexpected.incrementAndGet();
                        sample.compareAndSet(null, e);
                    }
                } catch (Throwable t) {
                    unexpected.incrementAndGet();
                    sample.compareAndSet(null, t);
                } finally {
                    finished.countDown();
                }
            });
        }

        fireAtOnce.countDown();                          // release the stampede
        assertTrue(finished.await(60, TimeUnit.SECONDS), "all threads should finish");
        pool.shutdownNow();

        assertEquals(1, successes.get(), "exactly one booking must succeed");
        assertEquals(0, unexpected.get(), "no unexpected errors; sample=" + sample.get());
        assertEquals(THREADS - 1, conflicts.get(), "every other attempt must be a 409 conflict");
    }
}
