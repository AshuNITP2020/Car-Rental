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

    /** Agency-scoped read: a booking only if it belongs to this agency. */
    Optional<Booking> findByIdAndAgency_Id(Long id, Long agencyId);

    /** Idempotency lookup: the booking previously created with this key, if any. */
    Optional<Booking> findByUser_IdAndIdempotencyKey(Long userId, String idempotencyKey);

    List<Booking> findByUser_IdOrderByStartTsDesc(Long userId);

    // --- scheduled-job finders (#30, #31) ---

    /** PENDING holds whose expiry has passed — to be EXPIRED and freed (#30). */
    List<Booking> findByStatusAndExpiresAtBefore(BookingStatus status, OffsetDateTime cutoff);

    /** Bookings in a status whose end has passed — overdue ACTIVE -> auto-complete (#31). */
    List<Booking> findByStatusAndEndTsBefore(BookingStatus status, OffsetDateTime cutoff);

    /** Bookings in a status starting within a window — for pickup reminders (#31). */
    List<Booking> findByStatusAndStartTsBetween(BookingStatus status, OffsetDateTime from, OffsetDateTime to);

    long countByStatus(BookingStatus status);
}
