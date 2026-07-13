package com.carrental.search;

/**
 * One hit from a proximity search: the matching car plus how far it is from the
 * search origin. Reuses {@link CarSearchResult} for the car payload so the two
 * search endpoints expose cars identically; {@code distanceKm} (rounded to two
 * decimals) is the only extra.
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
                row.getStatus(),
                null,   // rating enrichment happens in the service (bulk query)
                0);
        return new NearbyCarResult(round(row.getDistanceKm()), car);
    }

    /** Copy with the car's aggregate rating filled in. */
    public NearbyCarResult withRating(Double averageRating, long reviewCount) {
        return new NearbyCarResult(distanceKm, car.withRating(averageRating, reviewCount));
    }

    private static double round(double km) {
        return Math.round(km * 100.0) / 100.0;
    }
}
