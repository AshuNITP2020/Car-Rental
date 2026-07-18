package com.carrental.car;

import com.carrental.agency.AgencyRepository;
import com.carrental.agency.ServiceAreaService;
import com.carrental.car.dto.CreateCarRequest;
import com.carrental.car.dto.UpdateCarRequest;
import com.carrental.config.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class CarService {

    private final CarRepository cars;
    private final AgencyRepository agencies;
    private final ServiceAreaService serviceAreas;

    public CarService(CarRepository cars, AgencyRepository agencies,
                      ServiceAreaService serviceAreas) {
        this.cars = cars;
        this.agencies = agencies;
        this.serviceAreas = serviceAreas;
    }

    @Transactional(readOnly = true)
    public List<CarResponse> list(Long agencyId) {
        return cars.findByAgency_Id(agencyId).stream().map(CarResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CarResponse get(Long agencyId, Long carId) {
        return CarResponse.from(load(agencyId, carId));
    }

    @CacheEvict(cacheNames = CacheConfig.CAR_SEARCH_CACHE, allEntries = true)
    @Transactional
    public CarResponse create(Long agencyId, CreateCarRequest req) {
        requireInZone(agencyId, req.latitude(), req.longitude());
        Car car = new Car();
        car.setAgency(agencies.getReferenceById(agencyId));
        car.setMake(req.make().trim());
        car.setModel(req.model().trim());
        car.setCategory(req.category().trim());
        car.setRegNo(req.regNo().trim());
        car.setPricePerDay(req.pricePerDay());
        car.setLatitude(req.latitude());
        car.setLongitude(req.longitude());
        car.setStatus(CarStatus.AVAILABLE);
        // New cars start where their agency is (moves on completed one-way trips).
        car.setCurrentCity(car.getAgency().getCity());
        return CarResponse.from(saveUnique(car));
    }

    @CacheEvict(cacheNames = CacheConfig.CAR_SEARCH_CACHE, allEntries = true)
    @Transactional
    public CarResponse update(Long agencyId, Long carId, UpdateCarRequest req) {
        requireInZone(agencyId, req.latitude(), req.longitude());
        Car car = load(agencyId, carId);
        car.setMake(req.make().trim());
        car.setModel(req.model().trim());
        car.setCategory(req.category().trim());
        car.setRegNo(req.regNo().trim());
        car.setPricePerDay(req.pricePerDay());
        car.setStatus(req.status());
        car.setLatitude(req.latitude());
        car.setLongitude(req.longitude());
        return CarResponse.from(saveUnique(car));
    }

    @CacheEvict(cacheNames = CacheConfig.CAR_SEARCH_CACHE, allEntries = true)
    @Transactional
    public void delete(Long agencyId, Long carId) {
        cars.delete(load(agencyId, carId));
    }

    /**
     * A car placed outside its agency's operating area would be invisible to
     * search (the zone must cover the car) — reject it up front instead of
     * letting it vanish silently. No coordinates = parked at the agency base,
     * which is always fine; no zone drawn yet = nothing to validate against.
     */
    private void requireInZone(Long agencyId, Double lat, Double lng) {
        if (lat == null || lng == null) {
            return;
        }
        boolean hasZone = serviceAreas.get(agencyId).isPresent();
        if (hasZone && !serviceAreas.isCoveredBy(agencyId, lat, lng)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The car's location must be inside your operating area");
        }
    }

    /** Loads a car only within the tenant; 404 otherwise (no cross-tenant peek). */
    private Car load(Long agencyId, Long carId) {
        return cars.findByIdAndAgency_Id(carId, agencyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
    }

    /** Flush so the (agency_id, reg_no) unique constraint surfaces as 409. */
    private Car saveUnique(Car car) {
        try {
            return cars.saveAndFlush(car);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A car with this registration number already exists in your agency");
        }
    }
}
