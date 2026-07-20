package com.carrental.agency;

import com.carrental.agency.dto.CityArea;
import com.carrental.agency.dto.LatLng;
import com.carrental.agency.dto.ServiceAreaCitiesRequest;
import com.carrental.agency.dto.ServiceAreaResponse;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.pricing.OneWayFeeService;
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
    @Autowired OneWayFeeService oneWayFees;
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
        serviceAreas.updateCustom(agency.getId(), List.of(
                new LatLng(LAT - 0.5, LNG - 0.5),
                new LatLng(LAT - 0.5, LNG + 0.5),
                new LatLng(LAT + 0.5, LNG + 0.5),
                new LatLng(LAT + 0.5, LNG - 0.5)));
    }

    @Test
    void polygonRoundTrips() {
        ServiceAreaResponse area = serviceAreas.get(agency.getId());
        assertEquals("CUSTOM", area.mode());
        assertEquals(1, area.polygons().size(), "a hand-drawn area is one part");
        assertEquals(4, area.polygons().get(0).size(), "unclosed ring keeps its 4 corners");
    }

    @Test
    void citiesModeBuildsScatteredAreas() {
        // Two cities ~330 km apart with 30 km circles: two SEPARATE parts.
        ServiceAreaResponse area = serviceAreas.updateFromCities(agency.getId(),
                new ServiceAreaCitiesRequest(List.of(
                        new CityArea("CityA", LAT, LNG),
                        new CityArea("CityB", LAT + 3.0, LNG)), 30));

        assertEquals("CITIES", area.mode());
        assertEquals(30, area.radiusKm());
        assertEquals(2, area.cities().size(), "picked cities echo back for the console");
        assertEquals(2, area.polygons().size(), "distant circles stay separate parts");

        assertTrue(serviceAreas.isCoveredBy(agency.getId(), LAT, LNG), "inside circle A");
        assertTrue(serviceAreas.isCoveredBy(agency.getId(), LAT + 3.0, LNG), "inside circle B");
        assertFalse(serviceAreas.isCoveredBy(agency.getId(), LAT + 1.5, LNG),
                "the gap BETWEEN the circles is not covered — scattered means scattered");

        // Both trip ends in (different) parts of the SAME agency's area -> runnable.
        assertEquals(1, serviceAreas.routeCoverage(LAT, LNG, LAT + 3.0, LNG),
                "a scattered agency covers routes between its parts");
    }

    @Test
    void coversInsideButNotOutside() {
        assertTrue(serviceAreas.isCovered(LAT, LNG), "the base is inside the zone");
        assertTrue(serviceAreas.isCovered(LAT + 0.4, LNG + 0.4), "near the corner, still inside");
        assertFalse(serviceAreas.isCovered(LAT + 1.0, LNG + 1.0), "clearly outside");
    }

    @Test
    void searchMatchesOnlyWhenPickupPinIsInsideTheZone() {
        List<AgencySearchResult> inside = agencySearch.search(LAT, LNG, null, null, null, null, null, null);
        assertTrue(inside.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "pickup inside the polygon must match the agency");
        AgencySearchResult hit = inside.stream()
                .filter(a -> a.agencyId().equals(agency.getId())).findFirst().orElseThrow();
        assertEquals(1, hit.availableCars());
        assertEquals(1, hit.serviceArea().size(), "one area part rides along for the map");
        assertEquals(4, hit.serviceArea().get(0).size(), "with its 4-corner ring");

        List<AgencySearchResult> outside = agencySearch.search(LAT + 1.0, LNG + 1.0, null, null, null, null, null, null);
        assertFalse(outside.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "pickup outside the polygon must not match");
    }

    @Test
    void searchWithDestinationRequiresTheSameZoneToCoverBothEnds() {
        // Destination inside the zone -> still matches.
        List<AgencySearchResult> both = agencySearch.search(
                LAT, LNG, LAT + 0.4, LNG + 0.4, null, null, null, null);
        assertTrue(both.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "zone covers pickup and drop -> agency can run the trip");

        // Destination outside the zone -> the agency cannot run the trip.
        List<AgencySearchResult> dropOutside = agencySearch.search(
                LAT, LNG, LAT + 2.0, LNG, null, null, null, null);
        assertFalse(dropOutside.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "drop outside the polygon must exclude the agency even though pickup is inside");
    }

    @Test
    void searchFiltersByCarTypeAndSeats() {
        // The seeded car is an SUV with the default 5 seats.
        List<AgencySearchResult> suv = agencySearch.search(LAT, LNG, null, null, "suv", 5, null, null);
        assertTrue(suv.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "type matches case-insensitively and 5 seats fit");

        List<AgencySearchResult> hatchback = agencySearch.search(LAT, LNG, null, null, "HATCHBACK", null, null, null);
        assertFalse(hatchback.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "an agency with no matching car type must not appear");

        List<AgencySearchResult> bigGroup = agencySearch.search(LAT, LNG, null, null, null, 8, null, null);
        assertFalse(bigGroup.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "asking for more seats than any car has must exclude the agency");
    }

    @Test
    void pendingAgenciesAreInvisibleToSearch() {
        agency.setStatus(AgencyStatus.PENDING);
        agencies.save(agency);
        List<AgencySearchResult> results = agencySearch.search(LAT, LNG, null, null, null, null, null, null);
        assertFalse(results.stream().anyMatch(a -> a.agencyId().equals(agency.getId())),
                "an unapproved agency must not appear in search");
    }

    @Test
    void routeCoverageCountsAgenciesSpanningBothEnds() {
        assertEquals(1, serviceAreas.routeCoverage(LAT, LNG, LAT + 0.4, LNG + 0.4),
                "one agency covers the whole in-zone route");
        assertEquals(0, serviceAreas.routeCoverage(LAT, LNG, LAT + 2.0, LNG),
                "nobody covers a route ending outside every zone");
    }

    @Test
    void oneWayDropMustBeInsideTheCarsOwnAgencyZone() {
        // A second agency operates a DIFFERENT patch (around LAT+2) that
        // covers the drop point — but it isn't the booked car's agency.
        User owner2 = new User();
        owner2.setName("Owner2");
        owner2.setEmail("zone2-" + UUID.randomUUID() + "@test.local");
        owner2.setPasswordHash("x");
        users.save(owner2);
        Agency other = new Agency();
        other.setName("Other Zone Agency");
        other.setOwner(owner2);
        other.setCity("OtherZoneCity-" + UUID.randomUUID());
        other.setLatitude(LAT + 2.0);
        other.setLongitude(LNG);
        other.setStatus(AgencyStatus.ACTIVE);
        agencies.save(other);
        serviceAreas.updateCustom(other.getId(), List.of(
                new LatLng(LAT + 1.5, LNG - 0.5),
                new LatLng(LAT + 1.5, LNG + 0.5),
                new LatLng(LAT + 2.5, LNG + 0.5),
                new LatLng(LAT + 2.5, LNG - 0.5)));
        assertTrue(serviceAreas.isCovered(LAT + 2.0, LNG),
                "sanity: SOME agency covers the drop point");

        // In-zone drop: fee resolves.
        assertTrue(oneWayFees.feeFor(agency.getId(), LAT, LNG, LAT + 0.4, LNG + 0.4)
                .signum() > 0, "in-zone one-way resolves a positive fee");

        // Drop covered only by the OTHER agency: this agency's car can't go there.
        assertThrows(ResponseStatusException.class,
                () -> oneWayFees.feeFor(agency.getId(), LAT, LNG, LAT + 2.0, LNG),
                "a drop outside the car's own agency zone must be rejected");
    }

    @Test
    void rejectsDegeneratePolygons() {
        assertThrows(ResponseStatusException.class, () ->
                serviceAreas.updateCustom(agency.getId(), List.of(
                        new LatLng(LAT, LNG), new LatLng(LAT + 0.1, LNG + 0.1))),
                "fewer than 3 points is not an area");

        // Self-intersecting "bowtie" -> ST_IsValid is false -> 400.
        assertThrows(ResponseStatusException.class, () ->
                serviceAreas.updateCustom(agency.getId(), List.of(
                        new LatLng(LAT, LNG),
                        new LatLng(LAT + 0.4, LNG + 0.4),
                        new LatLng(LAT + 0.4, LNG),
                        new LatLng(LAT, LNG + 0.4))));
    }
}
