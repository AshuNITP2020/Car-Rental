package com.carrental.search;

import com.carrental.agency.Agency;
import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyStatus;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarService;
import com.carrental.car.CarStatus;
import com.carrental.car.dto.CreateCarRequest;
import com.carrental.config.CacheConfig;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * the customer car-search cache and its invalidation, against the real
 * (dev) Redis + Postgres. {@code @Transactional} rolls the DB rows back; Redis
 * writes are not transactional, so each test scopes its search to a unique city
 * (unique cache key) and {@link #clearCache()} wipes the region afterwards.
 */
@SpringBootTest
@Transactional
class CarSearchCacheTest {

    @Autowired CarSearchService search;
    @Autowired CarService carService;
    @Autowired CacheManager cacheManager;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;

    private Agency agency;
    private final OffsetDateTime base = OffsetDateTime.parse("2026-09-01T10:00:00Z");

    @BeforeEach
    void seed() {
        User owner = new User();
        owner.setName("Owner");
        owner.setEmail("cache-owner-" + UUID.randomUUID() + "@test.local");
        owner.setPasswordHash("x");
        users.save(owner);

        agency = new Agency();
        agency.setName("Cache Agency");
        agency.setOwner(owner);
        agency.setCity("CacheCity-" + UUID.randomUUID());
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);

        addCar("SUV", "2000");   // one matching car to start
    }

    @AfterEach
    void clearCache() {
        cache().clear();
    }

    private void addCar(String category, String price) {
        Car c = new Car();
        c.setAgency(agency);
        c.setMake("Make");
        c.setModel("Model");
        c.setCategory(category);
        c.setRegNo("REG-" + UUID.randomUUID().toString().substring(0, 8));
        c.setPricePerDay(new BigDecimal(price));
        c.setStatus(CarStatus.AVAILABLE);
        cars.save(c);
    }

    private Cache cache() {
        return cacheManager.getCache(CacheConfig.CAR_SEARCH_CACHE);
    }

    /** Agency-only filter (from == null) -> cacheable. The test's own agency id
     *  makes the cache key unique per run (Redis writes aren't rolled back). */
    private CarSearchCriteria cacheable() {
        return new CarSearchCriteria(agency.getId(), null, null, 0, 20);
    }

    @Test
    void nonAvailabilitySearch_isCached_andManualEvictionRefreshes() {
        CarSearchCriteria c = cacheable();

        // Miss -> computes (1 car) and stores under the criteria's key.
        assertEquals(1, search.search(c).totalElements());
        assertNotNull(cache().get(c.cacheKey()), "result should have been cached");

        // Add a second matching car WITHOUT going through CarService (no eviction).
        addCar("SUV", "3000");

        // Hit -> still the stale page (1), proving the read was served from cache.
        assertEquals(1, search.search(c).totalElements());

        // Evict -> next call recomputes and sees both cars (synchronous writer, #34).
        cache().clear();
        assertNull(cache().get(c.cacheKey()), "clear should have removed the entry");
        assertEquals(2, search.search(c).totalElements());
    }

    @Test
    void carServiceWrite_evictsCache() {
        CarSearchCriteria c = cacheable();
        search.search(c);
        assertNotNull(cache().get(c.cacheKey()), "precondition: result is cached");

        // A real car write must invalidate the region (@CacheEvict on CarService).
        carService.create(agency.getId(), new CreateCarRequest(
                "Tata", "Nexon", "SUV", "REG-" + UUID.randomUUID().toString().substring(0, 8),
                new BigDecimal("2500"), null, null));

        assertNull(cache().get(c.cacheKey()), "car write should have evicted the cache");
    }

    @Test
    void availabilitySearch_isNotCached() {
        // from/to present -> @Cacheable condition is false -> never cached.
        CarSearchCriteria c = new CarSearchCriteria(
                agency.getId(), base.plusDays(1), base.plusDays(2), 0, 20);

        search.search(c);

        assertNull(cache().get(c.cacheKey()), "availability-window searches must not be cached");
    }
}
