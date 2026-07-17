package com.carrental.booking;

/**
 * How the rental ends:
 *  - ROUND_TRIP: the car comes back to the pickup agency (default).
 *  - ONE_WAY:    the car is dropped in another city; the customer pays a
 *                distance-based relocation fee and, on completion, the car's
 *                current city moves to the drop city.
 */
public enum TripType {
    ROUND_TRIP,
    ONE_WAY
}
