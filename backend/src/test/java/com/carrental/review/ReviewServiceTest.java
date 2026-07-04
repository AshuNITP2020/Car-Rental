package com.carrental.review;

import com.carrental.agency.Agency;
import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyStatus;
import com.carrental.booking.Booking;
import com.carrental.booking.BookingRepository;
import com.carrental.booking.BookingStatus;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.review.dto.CarReviewsResponse;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Task #39: reviews & ratings, against the real (dev) Postgres. {@code @Transactional}
 * rolls the seed back. Aggregation is asserted on a car that only this test touches.
 */
@SpringBootTest
@Transactional
class ReviewServiceTest {

    @Autowired ReviewService reviews;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;
    @Autowired BookingRepository bookings;

    private Long userId, otherUserId, carId;
    private Long b1, b2, b3, bOther;   // b1/b2 completed (user), b3 confirmed (user), bOther completed (otherUser)
    private User user, otherUser;
    private Agency agency;
    private Car car;
    private final OffsetDateTime now = OffsetDateTime.now();

    @BeforeEach
    void seed() {
        user = newUser("cust");
        otherUser = newUser("other");
        User owner = newUser("owner");
        userId = user.getId();
        otherUserId = otherUser.getId();

        agency = new Agency();
        agency.setName("Review Agency");
        agency.setOwner(owner);
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);

        car = new Car();
        car.setAgency(agency);
        car.setMake("Tata");
        car.setModel("Nexon");
        car.setCategory("SUV");
        car.setRegNo("REV-" + UUID.randomUUID().toString().substring(0, 8));
        car.setPricePerDay(new BigDecimal("2000"));
        car.setStatus(CarStatus.AVAILABLE);
        cars.save(car);
        carId = car.getId();

        b1 = booking(user, BookingStatus.COMPLETED, now.minusDays(20), now.minusDays(18));
        b2 = booking(user, BookingStatus.COMPLETED, now.minusDays(10), now.minusDays(8));
        b3 = booking(user, BookingStatus.CONFIRMED, now.plusDays(5), now.plusDays(7));
        bOther = booking(otherUser, BookingStatus.COMPLETED, now.minusDays(30), now.minusDays(28));
    }

    private User newUser(String tag) {
        User u = new User();
        u.setName(tag);
        u.setEmail("rev-" + tag + "-" + UUID.randomUUID() + "@test.local");
        u.setPasswordHash("x");
        users.save(u);
        return u;
    }

    private Long booking(User u, BookingStatus status, OffsetDateTime start, OffsetDateTime end) {
        Booking b = new Booking();
        b.setCar(car);
        b.setUser(u);
        b.setAgency(agency);
        b.setStartTs(start);
        b.setEndTs(end);
        b.setStatus(status);
        b.setAmount(new BigDecimal("1000"));
        bookings.save(b);
        return b.getId();
    }

    @Test
    void reviewCompletedBookings_thenAggregatePerCar() {
        // No reviews yet.
        CarReviewsResponse empty = reviews.carReviews(carId);
        assertEquals(0, empty.count());
        assertNull(empty.averageRating());

        reviews.create(userId, b1, 4, "great");
        reviews.create(userId, b2, 2, "meh");

        CarReviewsResponse cr = reviews.carReviews(carId);
        assertEquals(2, cr.count());
        assertEquals(3.0, cr.averageRating(), 0.001);   // (4 + 2) / 2
        assertEquals(2, cr.reviews().size());

        // The owner can read their booking's review; another user cannot reach it.
        assertEquals(4, reviews.getForBooking(userId, b1).rating());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> reviews.getForBooking(otherUserId, b1)).getStatusCode());
    }

    @Test
    void cannotReviewBookingThatIsNotCompleted() {
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> reviews.create(userId, b3, 5, null)).getStatusCode());
    }

    @Test
    void cannotReviewSameBookingTwice() {
        reviews.create(userId, b1, 5, "first");
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> reviews.create(userId, b1, 3, "second")).getStatusCode());
    }

    @Test
    void cannotReviewAnotherUsersBooking() {
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> reviews.create(userId, bOther, 5, null)).getStatusCode());
    }

    @Test
    void rejectsOutOfRangeRating() {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
                () -> reviews.create(userId, b1, 6, null)).getStatusCode());
    }
}
