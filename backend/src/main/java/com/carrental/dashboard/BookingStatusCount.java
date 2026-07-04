package com.carrental.dashboard;

import com.carrental.booking.BookingStatus;

/** Projection for "bookings grouped by status". */
public interface BookingStatusCount {
    BookingStatus getStatus();

    long getCount();
}
