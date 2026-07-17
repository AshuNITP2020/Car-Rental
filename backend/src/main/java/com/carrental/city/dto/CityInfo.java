package com.carrental.city.dto;

/** An operating city: at least one agency is based there. The centroid is the
 *  average of its agencies' coordinates (used for distance estimates). */
public record CityInfo(String city, long agencyCount, Double latitude, Double longitude) {
}
