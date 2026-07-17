package com.carrental.agency;

import com.carrental.agency.dto.LatLng;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.search.AgencySearchResult;
import com.carrental.search.AgencySearchService;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Agency operating areas (V16): polygon round-trip, point coverage, and the
 * trip search matching agencies whose zone covers the pickup pin. Runs against
 * live PostGIS; a remote ocean coordinate keeps the tests clear of seed data.
 */
@SpringBootTest
@Transactional
class ServiceAreaTest {

    // A patch of the South Atlantic — guaranteed free of seeded agencies.
    private static final double LAT = -40.0, LNG = -20.0;

    @Autowired ServiceAreaService serviceAreas;
    @Autowired AgencySearchService agencySearch;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;

    private Agency agency;

    @BeforeEach
    void seed() {
        User owner = new User();
        owner.setName("Owner");
        owner.setEmail("zone-" + UUID.randomUUID() + "@test.local");
        owner.setPasswordHash("x");
        users.save(owner);

        agency = new Agency();
        agency.setName("Zone Agency");
        agency.setOwner(owner);
        agency.setCity("ZoneCity-" + UUID.randomUUID());
        agency.setLatitude(LAT);
        agency.setLongitude(LNG);
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);

        Car car = new Car();
        car.setAgency(agency);
        car.setMake("Zone");
        car.setModel("Car");
        car.setCategory("SUV");
        car.setRegNo("ZONE-" + UUID.randomUUID().toString().substring(0, 8));
        car.setPricePerDay(new BigDecimal("1000"));
        car.setStatus(CarStatus.AVAILABLE);
        car.setLatitude(LAT);
        car.setLongitude(LNG);
        cars.save(car);

        // ~0.5° square around the base (~55 km) — the operating area.
        serviceAreas.update(agency.getId(), List.of(
                new LatLng(LAT - 0.5, LNG - 0.5),
                new LatLng(LAT - 0.5, LNG + 0.5),
                new LatLng(LAT + 0.5, LNG + 0.5),
                new LatLng(LAT + 0.5, LNG - 0.5)));
    }

    @Test
    void polygonRoundTrips() {
        List<LatLng> ring = serviceAreas.get(agency.getId()).orElseThrow();
        assertEquals(4, ring.size(), "unclosed ring comes back with its 4 corners");
    }

    @Test
    void coversInsideButNotOutside() {
        assertTrue(serviceAreas.isCovered(LAT, LNG), "the base is inside the zone");
        assertTrue(serviceAreas.isCovered(LAT + 0.4, LNG + 0.4), "near the corner, still inside");
        assertFalse(serviceAreas.isCovered(LAT + 1.0, LNG + 1.0), "clearly outside");
    }

    @Test
    void searchMatchesOnlyWhenPickupPinIsInsideTheZone() {
        List<AgencySearchResult> inside = agencySearch.search(LAT, LNG, null, null);
        assertTrue(inside.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "pickup inside the polygon must match the agency");
        AgencySearchResult hit = inside.stream()
                .filter(a -> a.agencyId().equals(agency.getId())).findFirst().orElseThrow();
        assertEquals(1, hit.availableCars());
        assertEquals(4, hit.serviceArea().size(), "the zone ring rides along for the map");

        List<AgencySearchResult> outside = agencySearch.search(LAT + 1.0, LNG + 1.0, null, null);
        assertFalse(outside.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "pickup outside the polygon must not match");
    }

    @Test
    void rejectsDegeneratePolygons() {
        assertThrows(ResponseStatusException.class, () ->
                serviceAreas.update(agency.getId(), List.of(
                        new LatLng(LAT, LNG), new LatLng(LAT + 0.1, LNG + 0.1))),
                "fewer than 3 points is not an area");

        // Self-intersecting "bowtie" -> ST_IsValid is false -> 400.
        assertThrows(ResponseStatusException.class, () ->
                serviceAreas.update(agency.getId(), List.of(
                        new LatLng(LAT, LNG),
                        new LatLng(LAT + 0.4, LNG + 0.4),
                        new LatLng(LAT + 0.4, LNG),
                        new LatLng(LAT, LNG + 0.4))));
    }
}
