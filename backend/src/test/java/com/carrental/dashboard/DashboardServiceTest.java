package com.carrental.dashboard;

import com.carrental.agency.Agency;
import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyStatus;
import com.carrental.booking.Booking;
import com.carrental.booking.BookingRepository;
import com.carrental.booking.BookingStatus;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * agency dashboard aggregations, against the real (dev) Postgres. Every
 * query is scoped to this test's fresh agency id, so the ~5k pre-existing seed
 * rows never perturb the numbers. {@code @Transactional} rolls the seed back.
 *
 * <p>Note: {@code created_at} is a Hibernate @CreationTimestamp (always "now" on
 * insert), so all seeded bookings land in the current month — the trend has one
 * row and last-30-days revenue equals all-time. Booking windows (start/end),
 * which the test does control, drive utilization and idle.
 */
@SpringBootTest
@Transactional
class DashboardServiceTest {

    @Autowired DashboardService dashboard;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;
    @Autowired BookingRepository bookings;

    private Long agencyId;
    private Agency agency;
    private User owner;
    private final OffsetDateTime now = OffsetDateTime.now();

    @BeforeEach
    void seed() {
        owner = new User();
        owner.setName("Owner");
        owner.setEmail("dash-" + UUID.randomUUID() + "@test.local");
        owner.setPasswordHash("x");
        users.save(owner);

        agency = new Agency();
        agency.setName("Dashboard Agency");
        agency.setOwner(owner);
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);
        agencyId = agency.getId();

        Car car1 = car(CarStatus.AVAILABLE);
        Car car2 = car(CarStatus.AVAILABLE);
        Car car3 = car(CarStatus.AVAILABLE);
        car(CarStatus.MAINTENANCE);                                    // 4th car, no bookings

        booking(car1, BookingStatus.COMPLETED, "1000", now.minusDays(60), now.minusDays(57)); // past, realized
        booking(car2, BookingStatus.CONFIRMED, "2000", now.minusDays(1), now.plusDays(2));     // spans now
        booking(car3, BookingStatus.CANCELLED, "500", now.minusDays(1), now.plusDays(2));       // ignored
    }

    private Car car(CarStatus status) {
        Car c = new Car();
        c.setAgency(agency);
        c.setMake("Make");
        c.setModel("Model");
        c.setCategory("SUV");
        c.setRegNo("DASH-" + UUID.randomUUID().toString().substring(0, 8));
        c.setPricePerDay(new BigDecimal("1500"));
        c.setStatus(status);
        cars.save(c);
        return c;
    }

    private void booking(Car car, BookingStatus status, String amount,
                         OffsetDateTime start, OffsetDateTime end) {
        Booking b = new Booking();
        b.setCar(car);
        b.setUser(owner);
        b.setAgency(agency);
        b.setStartTs(start);
        b.setEndTs(end);
        b.setStatus(status);
        b.setAmount(new BigDecimal(amount));
        bookings.save(b);
    }

    @Test
    void aggregatesFleetBookingsRevenueUtilizationIdleAndTrends() {
        AgencyDashboardResponse d = dashboard.forAgency(agencyId);

        // Fleet: 4 cars — 3 AVAILABLE, 1 MAINTENANCE.
        assertEquals(4, d.fleet().totalCars());
        assertEquals(3L, d.fleet().byStatus().get("AVAILABLE"));
        assertEquals(1L, d.fleet().byStatus().get("MAINTENANCE"));

        // Bookings: one each COMPLETED / CONFIRMED / CANCELLED.
        assertEquals(3, d.bookings().totalBookings());
        assertEquals(1L, d.bookings().byStatus().get("COMPLETED"));
        assertEquals(1L, d.bookings().byStatus().get("CONFIRMED"));
        assertEquals(1L, d.bookings().byStatus().get("CANCELLED"));

        // Revenue: realized = COMPLETED(1000) + CONFIRMED(2000) = 3000; CANCELLED excluded.
        assertEquals(0, new BigDecimal("3000").compareTo(d.revenue().total()));
        assertEquals(0, new BigDecimal("3000").compareTo(d.revenue().last30Days()));

        // Utilization: only car2 is booked right now -> 1 of 4 = 25%.
        assertEquals(25.0, d.utilizationPercent(), 0.001);

        // Idle: AVAILABLE cars with no realized booking ending in the last 30 days ->
        // car1 (ended 57d ago) + car3 (only a cancelled booking) = 2.
        assertEquals(2, d.idleCarCount());

        // Trends: all created this month -> one row, 3 bookings, 3000 realized revenue.
        assertEquals(1, d.trends().size());
        assertEquals(3, d.trends().get(0).bookings());
        assertEquals(0, new BigDecimal("3000").compareTo(d.trends().get(0).revenue()));
    }
}
