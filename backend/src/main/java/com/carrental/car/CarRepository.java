package com.carrental.car;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

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

    /**
     * Pessimistic write lock on the car row -> SELECT ... FOR UPDATE.
     * Concurrent bookings for the same car serialize behind this lock, which
     * makes the subsequent app-level overlap check race-free. The lock is held
     * until the surrounding transaction commits.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Car c where c.id = :id")
    Optional<Car> findByIdForUpdate(Long id);

    /**
     * Optimistic variant: reads the car and schedules a version
     * bump at flush. Two concurrent bookings both force-increment, so the
     * second to commit fails with an optimistic-lock error and is retried.
     */
    @Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)
    @Query("select c from Car c where c.id = :id")
    Optional<Car> findByIdOptimistic(Long id);
}
