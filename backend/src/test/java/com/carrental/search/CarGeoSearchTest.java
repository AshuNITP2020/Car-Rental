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
 * PostGIS "cars near me" proximity search, against the real (dev)
 * Postgres+PostGIS. {@code @Transactional} rolls the seeded rows back; the
 * car.geog generated column (V11) is computed by Postgres on insert and is
 * visible to the native query in the same transaction. Every search filters on a
 * unique category so the ~5k pre-existing seed cars can't perturb the assertions.
 *
 * <p>Cars are placed due north of a single origin so distances are easy to
 * reason about: 1° of latitude ≈ 111 km, so 0.045°/0.9°/2.25° ≈ 5/100/250 km.
 */
@SpringBootTest
@Transactional
class CarGeoSearchTest {

    @Autowired CarSearchService search;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;
    @Autowired BookingRepository bookings;

    private static final double O_LAT = 19.0;
    private static final double O_LNG = 72.0;

    private String category;
    private Long atOrigin, near5km, mid100km, far250km, maintenanceNear, coordless;
    private final OffsetDateTime base = OffsetDateTime.parse("2026-09-01T10:00:00Z");
    private Agency agency;
    private User owner;

    @BeforeEach
    void seed() {
        category = "GEO-" + UUID.randomUUID().toString().substring(0, 8);

        owner = new User();
        owner.setName("Owner");
        owner.setEmail("geo-owner-" + UUID.randomUUID() + "@test.local");
        owner.setPasswordHash("x");
        users.save(owner);

        agency = new Agency();
        agency.setName("Geo Agency");
        agency.setOwner(owner);
        agency.setCity("GeoCity");
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);

        atOrigin = car(O_LAT, O_LNG, CarStatus.AVAILABLE);            // ~0 km
        near5km = car(O_LAT + 0.045, O_LNG, CarStatus.AVAILABLE);     // ~5 km
        mid100km = car(O_LAT + 0.9, O_LNG, CarStatus.AVAILABLE);      // ~100 km
        far250km = car(O_LAT + 2.25, O_LNG, CarStatus.AVAILABLE);     // ~250 km
        // At the origin but not bookable -> must never appear.
        maintenanceNear = car(O_LAT, O_LNG, CarStatus.MAINTENANCE);
        // Available but has no coordinates -> geog is NULL -> must never appear.
        coordless = car(null, null, CarStatus.AVAILABLE);
    }

    private Long car(Double lat, Double lng, CarStatus status) {
        Car c = new Car();
        c.setAgency(agency);
        c.setMake("Make");
        c.setModel("Model");
        c.setCategory(category);
        c.setRegNo("GEO-" + UUID.randomUUID().toString().substring(0, 8));
        c.setPricePerDay(new BigDecimal("1500"));
        c.setLatitude(lat);
        c.setLongitude(lng);
        c.setStatus(status);
        cars.save(c);
        return c.getId();
    }

    private NearbyCarCriteria nearby(double radiusKm, OffsetDateTime from, OffsetDateTime to) {
        // Always scope to our unique category so seed data is excluded.
        return new NearbyCarCriteria(O_LAT, O_LNG, radiusKm, category, null, null, null, from, to, 0, 20);
    }

    private List<Long> ids(PageResponse<NearbyCarResult> p) {
        return p.content().stream().map(r -> r.car().id()).toList();
    }

    @Test
    void smallRadius_returnsOnlyCloseCarsNearestFirst() {
        PageResponse<NearbyCarResult> r = search.searchNearby(nearby(10, null, null));

        assertEquals(2, r.totalElements());
        assertEquals(List.of(atOrigin, near5km), ids(r));

        // Distances are reported (km) and ordered ascending.
        assertEquals(0.0, r.content().get(0).distanceKm(), 0.2);
        assertTrue(r.content().get(1).distanceKm() > 4.5 && r.content().get(1).distanceKm() < 5.5,
                "near car should be ~5 km, was " + r.content().get(1).distanceKm());
    }

    @Test
    void largerRadius_includesMoreStillOrderedByDistance() {
        PageResponse<NearbyCarResult> r = search.searchNearby(nearby(300, null, null));

        assertEquals(List.of(atOrigin, near5km, mid100km, far250km), ids(r));
        // Excluded regardless of radius: not-bookable and coordinate-less cars.
        assertFalse(ids(r).contains(maintenanceNear));
        assertFalse(ids(r).contains(coordless));

        double dMid = r.content().get(2).distanceKm();
        double dFar = r.content().get(3).distanceKm();
        assertTrue(dMid > 95 && dMid < 105, "mid car should be ~100 km, was " + dMid);
        assertTrue(dFar > 240 && dFar < 260, "far car should be ~250 km, was " + dFar);
    }

    @Test
    void availabilityWindow_dropsCarsBookedForOverlap() {
        // Book the origin car for [base+1d, base+3d).
        Booking b = new Booking();
        b.setCar(cars.findById(atOrigin).orElseThrow());
        b.setUser(owner);
        b.setAgency(agency);
        b.setStartTs(base.plusDays(1));
        b.setEndTs(base.plusDays(3));
        b.setStatus(BookingStatus.CONFIRMED);
        bookings.save(b);

        // Overlapping window -> origin car drops out, near car becomes nearest.
        PageResponse<NearbyCarResult> overlap =
                search.searchNearby(nearby(300, base.plusDays(1), base.plusDays(2)));
        assertEquals(List.of(near5km, mid100km, far250km), ids(overlap));

        // Window clear of the booking -> origin car is back and nearest again.
        PageResponse<NearbyCarResult> clear =
                search.searchNearby(nearby(300, base.plusDays(10), base.plusDays(11)));
        assertEquals(List.of(atOrigin, near5km, mid100km, far250km), ids(clear));
    }
}
