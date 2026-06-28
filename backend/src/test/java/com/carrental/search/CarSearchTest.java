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
 * Task #32: car search filters/sort/pagination, exercised against the real (dev)
 * Postgres. {@code @Transactional} rolls the seeded rows back after each test;
 * because it's single-threaded the read sees its own writes. Every search is
 * scoped to a unique city so pre-existing seed data can't perturb the assertions.
 */
@SpringBootTest
@Transactional
class CarSearchTest {

    @Autowired CarSearchService search;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;
    @Autowired BookingRepository bookings;

    private String city;
    private Long hatchId, suvCheapId, suvDearId;
    private final OffsetDateTime base = OffsetDateTime.parse("2026-09-01T10:00:00Z");

    @BeforeEach
    void seed() {
        city = "SearchCity-" + UUID.randomUUID();

        User owner = new User();
        owner.setName("Owner");
        owner.setEmail("owner-" + UUID.randomUUID() + "@test.local");
        owner.setPasswordHash("x");
        users.save(owner);

        Agency agency = new Agency();
        agency.setName("Search Agency");
        agency.setOwner(owner);
        agency.setCity(city);
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);

        hatchId = car(agency, "Maruti", "Swift", "Hatchback", "1000", CarStatus.AVAILABLE);
        suvCheapId = car(agency, "Tata", "Nexon", "SUV", "2000", CarStatus.AVAILABLE);
        suvDearId = car(agency, "Toyota", "Fortuner", "SUV", "3000", CarStatus.AVAILABLE);
        // Not bookable -> must never appear in results.
        car(agency, "Mahindra", "Thar", "SUV", "1500", CarStatus.MAINTENANCE);

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

    private Long car(Agency a, String make, String model, String category, String price, CarStatus status) {
        Car c = new Car();
        c.setAgency(a);
        c.setMake(make);
        c.setModel(model);
        c.setCategory(category);
        c.setRegNo("REG-" + UUID.randomUUID().toString().substring(0, 8));
        c.setPricePerDay(new BigDecimal(price));
        c.setStatus(status);
        cars.save(c);
        return c.getId();
    }

    private CarSearchCriteria criteria(String category, String q, BigDecimal min, BigDecimal max,
                                       OffsetDateTime from, OffsetDateTime to, String sort, int page, int size) {
        return new CarSearchCriteria(city, category, q, min, max, from, to, sort, page, size);
    }

    private List<Long> ids(PageResponse<CarSearchResult> p) {
        return p.content().stream().map(CarSearchResult::id).toList();
    }

    @Test
    void cityFilter_returnsOnlyAvailableCarsInCity() {
        PageResponse<CarSearchResult> r =
                search.search(criteria(null, null, null, null, null, null, "price,asc", 0, 20));

        // 3 AVAILABLE cars; the MAINTENANCE one is excluded.
        assertEquals(3, r.totalElements());
        assertEquals(List.of(hatchId, suvCheapId, suvDearId), ids(r));
    }

    @Test
    void categoryFilter_caseInsensitive() {
        PageResponse<CarSearchResult> r =
                search.search(criteria("suv", null, null, null, null, null, "price,asc", 0, 20));
        assertEquals(List.of(suvCheapId, suvDearId), ids(r));
    }

    @Test
    void priceRangeFilter() {
        PageResponse<CarSearchResult> min2k =
                search.search(criteria(null, null, new BigDecimal("2000"), null, null, null, "price,asc", 0, 20));
        assertEquals(List.of(suvCheapId, suvDearId), ids(min2k));

        PageResponse<CarSearchResult> max1k =
                search.search(criteria(null, null, null, new BigDecimal("1000"), null, null, "price,asc", 0, 20));
        assertEquals(List.of(hatchId), ids(max1k));
    }

    @Test
    void freeTextMatchesMakeOrModel() {
        PageResponse<CarSearchResult> r =
                search.search(criteria(null, "fortun", null, null, null, null, "price,asc", 0, 20));
        assertEquals(List.of(suvDearId), ids(r));
    }

    @Test
    void availability_excludesCarsBookedForOverlappingWindow() {
        // Window overlaps the cheap SUV's booking -> it drops out.
        PageResponse<CarSearchResult> overlap = search.search(
                criteria(null, null, null, null, base.plusDays(1), base.plusDays(2), "price,asc", 0, 20));
        assertEquals(List.of(hatchId, suvDearId), ids(overlap));

        // Window clear of any booking -> all three available again.
        PageResponse<CarSearchResult> clear = search.search(
                criteria(null, null, null, null, base.plusDays(10), base.plusDays(11), "price,asc", 0, 20));
        assertEquals(List.of(hatchId, suvCheapId, suvDearId), ids(clear));
    }

    @Test
    void sortByPriceDescending() {
        PageResponse<CarSearchResult> r =
                search.search(criteria(null, null, null, null, null, null, "price,desc", 0, 20));
        assertEquals(List.of(suvDearId, suvCheapId, hatchId), ids(r));
    }

    @Test
    void pagination_splitsResultsAndReportsMetadata() {
        PageResponse<CarSearchResult> p0 =
                search.search(criteria(null, null, null, null, null, null, "price,asc", 0, 2));
        assertEquals(List.of(hatchId, suvCheapId), ids(p0));
        assertEquals(3, p0.totalElements());
        assertEquals(2, p0.totalPages());
        assertTrue(p0.hasNext());

        PageResponse<CarSearchResult> p1 =
                search.search(criteria(null, null, null, null, null, null, "price,asc", 1, 2));
        assertEquals(List.of(suvDearId), ids(p1));
        assertFalse(p1.hasNext());
    }
}
