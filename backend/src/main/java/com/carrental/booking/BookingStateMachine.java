package com.carrental.booking;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * The single authority for booking status transitions. Centralizing the allowed
 * moves means an illegal transition (e.g. COMPLETED -> ACTIVE) is rejected
 * everywhere, not just where someone remembered to check.
 *
 *   PENDING   -> CONFIRMED | CANCELLED | EXPIRED
 *   CONFIRMED -> ACTIVE | CANCELLED
 *   ACTIVE    -> COMPLETED
 *   COMPLETED | CANCELLED | EXPIRED -> (terminal)
 */
@Component
public class BookingStateMachine {

    private static final Map<BookingStatus, Set<BookingStatus>> ALLOWED =
            new EnumMap<>(BookingStatus.class);

    static {
        ALLOWED.put(BookingStatus.PENDING, EnumSet.of(
                BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.EXPIRED));
        ALLOWED.put(BookingStatus.CONFIRMED, EnumSet.of(
                BookingStatus.ACTIVE, BookingStatus.CANCELLED));
        ALLOWED.put(BookingStatus.ACTIVE, EnumSet.of(BookingStatus.COMPLETED));
        ALLOWED.put(BookingStatus.COMPLETED, EnumSet.noneOf(BookingStatus.class));
        ALLOWED.put(BookingStatus.CANCELLED, EnumSet.noneOf(BookingStatus.class));
        ALLOWED.put(BookingStatus.EXPIRED, EnumSet.noneOf(BookingStatus.class));
    }

    public boolean canTransition(BookingStatus from, BookingStatus to) {
        return ALLOWED.getOrDefault(from, Set.of()).contains(to);
    }

    /** Applies the transition on the entity, or 409s if it isn't allowed. */
    public void transition(Booking booking, BookingStatus target) {
        BookingStatus from = booking.getStatus();
        if (!canTransition(from, target)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Illegal booking transition: " + from + " -> " + target);
        }
        booking.setStatus(target);
    }
}
