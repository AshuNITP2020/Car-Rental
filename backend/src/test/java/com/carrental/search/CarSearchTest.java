package com.carrental.search;

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
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Car search (agency scoping, availability window, ordering, pagination),
 * exercised against the real (dev) Postgres. {@code @Transactional} rolls the
 * seeded rows back after each test; because it's single-threaded the read sees
 * its own writes. Every search is scoped to the test's own agency so
 * pre-existing seed data can't perturb the assertions.
 */
@SpringBootTest
@Transactional
class CarSearchTest {

    @Autowired CarSearchService search;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;
    @Autowired BookingRepository bookings;

    private Agency agency;
    private Long hatchId, suvCheapId, suvDearId;
    private final OffsetDateTime base = OffsetDateTime.parse("2026-09-01T10:00:00Z");

    @BeforeEach
    void seed() {
        User owner = new User();
        owner.setName("Owner");
        owner.setEmail("owner-" + UUID.randomUUID() + "@test.local");
        owner.setPasswordHash("x");
        users.save(owner);

        agency = new Agency();
        agency.setName("Search Agency");
        agency.setOwner(owner);
        agency.setCity("SearchCity-" + UUID.randomUUID());
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);

        hatchId = car("Maruti", "Swift", "1000", CarStatus.AVAILABLE);
        suvCheapId = car("Tata", "Nexon", "2000", CarStatus.AVAILABLE);
        suvDearId = car("Toyota", "Fortuner", "3000", CarStatus.AVAILABLE);
        // Not bookable -> must never appear in results.
        car("Mahindra", "Thar", "1500", CarStatus.MAINTENANCE);

        // Block the cheap SUV for [base+1d, base+3d).
        Booking b = new Booking();
        b.setCar(cars.findById(suvCheapId).orElseThrow());
        b.setUser(owner);
        b.setAgency(agency);
        b.setStartTs(base.plusDays(1));
        b.setEndTs(base.plusDays(3));
        b.setStatus(BookingStatus.CONFIRMED);
        bookings.save(b);
    }

    private Long car(String make, String model, String price, CarStatus status) {
        Car c = new Car();
        c.setAgency(agency);
        c.setMake(make);
        c.setModel(model);
        c.setCategory("SUV");
        c.setRegNo("REG-" + UUID.randomUUID().toString().substring(0, 8));
        c.setPricePerDay(new BigDecimal(price));
        c.setStatus(status);
        cars.save(c);
        return c.getId();
    }

    private CarSearchCriteria criteria(OffsetDateTime from, OffsetDateTime to, int page, int size) {
        return new CarSearchCriteria(agency.getId(), from, to, page, size);
    }

    private List<Long> ids(PageResponse<CarSearchResult> p) {
        return p.content().stream().map(CarSearchResult::id).toList();
    }

    @Test
    void agencyFilter_returnsOnlyItsAvailableCars_cheapestFirst() {
        PageResponse<CarSearchResult> r = search.search(criteria(null, null, 0, 20));

        // 3 AVAILABLE cars, cheapest first; the MAINTENANCE one is excluded and
        // no other agency's inventory leaks in.
        assertEquals(3, r.totalElements());
        assertEquals(List.of(hatchId, suvCheapId, suvDearId), ids(r));
        assertTrue(r.content().stream().allMatch(c -> c.agencyId().equals(agency.getId())));
    }

    @Test
    void availability_excludesCarsBookedForOverlappingWindow() {
        // Window overlaps the cheap SUV's booking -> it drops out.
        PageResponse<CarSearchResult> overlap =
                search.search(criteria(base.plusDays(1), base.plusDays(2), 0, 20));
        assertEquals(List.of(hatchId, suvDearId), ids(overlap));

        // Window clear of any booking -> all three available again.
        PageResponse<CarSearchResult> clear =
                search.search(criteria(base.plusDays(10), base.plusDays(11), 0, 20));
        assertEquals(List.of(hatchId, suvCheapId, suvDearId), ids(clear));
    }

    @Test
    void pagination_splitsResultsAndReportsMetadata() {
        PageResponse<CarSearchResult> p0 = search.search(criteria(null, null, 0, 2));
        assertEquals(List.of(hatchId, suvCheapId), ids(p0));
        assertEquals(3, p0.totalElements());
        assertEquals(2, p0.totalPages());
        assertTrue(p0.hasNext());

        PageResponse<CarSearchResult> p1 = search.search(criteria(null, null, 1, 2));
        assertEquals(List.of(suvDearId), ids(p1));
        assertFalse(p1.hasNext());
    }
}
