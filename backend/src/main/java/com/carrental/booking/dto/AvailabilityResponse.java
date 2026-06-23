package com.carrental.booking.dto;

import java.time.OffsetDateTime;

/** Whether a car is bookable for a window; `reason` is set only when not. */
public record AvailabilityResponse(
        Long carId,
        OffsetDateTime from,
        OffsetDateTime to,
        boolean available,
        String reason
) {
    public static AvailabilityResponse free(Long carId, OffsetDateTime from, OffsetDateTime to) {
        return new AvailabilityResponse(carId, from, to, true, null);
    }

    public static AvailabilityResponse taken(Long carId, OffsetDateTime from, OffsetDateTime to, String reason) {
        return new AvailabilityResponse(carId, from, to, false, reason);
    }
}
