package com.carrental.car;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CarRepository extends JpaRepository<Car, Long> {

    /** Tenant-scoped: only cars owned by the given agency. */
    List<Car> findByAgency_Id(Long agencyId);

    /**
     * Tenant-scoped lookup by id: returns the car only if it belongs to the
     * given agency. Empty for another agency's car -> caller gets a 404, so we
     * never reveal that the car exists.
     */
    Optional<Car> findByIdAndAgency_Id(Long id, Long agencyId);
}
