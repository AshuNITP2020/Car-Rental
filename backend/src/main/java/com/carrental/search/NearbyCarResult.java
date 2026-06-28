package com.carrental.search;

/**
 * One hit from a proximity search: the matching car plus how far it is from the
 * search origin. Reuses {@link CarSearchResult} for the car payload so the two
 * search endpoints expose cars identically; {@code distanceKm} (rounded to two
 * decimals) is the only extra. (Task #33)
 */
public record NearbyCarResult(double distanceKm, CarSearchResult car) {

    public static NearbyCarResult from(NearbyCarRow row) {
        CarSearchResult car = new CarSearchResult(
                row.getId(),
                row.getAgencyId(),
                row.getAgencyName(),
                row.getCity(),
                row.getMake(),
                row.getModel(),
                row.getCategory(),
                row.getPricePerDay(),
                row.getLatitude(),
                row.getLongitude(),
                row.getStatus());
        return new NearbyCarResult(round(row.getDistanceKm()), car);
    }

    private static double round(double km) {
        return Math.round(km * 100.0) / 100.0;
    }
}
