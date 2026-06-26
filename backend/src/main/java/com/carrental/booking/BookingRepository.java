package com.carrental.booking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    /**
     * Is there a slot-occupying booking for this car overlapping [from, to)?
     * Two ranges [a,b) and [c,d) overlap iff a < d AND b > c — here
     * startTs < to AND endTs > from.
     */
    boolean existsByCar_IdAndStatusInAndStartTsLessThanAndEndTsGreaterThan(
            Long carId, Collection<BookingStatus> statuses, OffsetDateTime to, OffsetDateTime from);

    /** Owner-scoped read: a booking only if it belongs to this user. */
    Optional<Booking> findByIdAndUser_Id(Long id, Long userId);

    /** Idempotency lookup: the booking previously created with this key, if any. */
    Optional<Booking> findByUser_IdAndIdempotencyKey(Long userId, String idempotencyKey);

    List<Booking> findByUser_IdOrderByStartTsDesc(Long userId);
}
