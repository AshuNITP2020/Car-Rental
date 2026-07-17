package com.carrental.geo.dto;

/**
 * One place from the geocoder: a display name ("Coimbatore"), its state
 * ("Tamil Nadu", may be null for state-level results), and the centroid the
 * pin should drop at.
 */
public record PlaceSuggestion(String name, String state, double lat, double lng) {
}
