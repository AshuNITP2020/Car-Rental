package com.carrental.dashboard;

import com.carrental.car.CarStatus;

/** Projection for "cars grouped by status". */
public interface CarStatusCount {
    CarStatus getStatus();

    long getCount();
}
