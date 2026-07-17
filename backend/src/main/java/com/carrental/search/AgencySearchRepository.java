package com.carrental.search;

import com.carrental.car.Car;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Trip-first aggregate: "which agencies OPERATE at my pickup pin, and what do
 * they offer?" — native PostGIS, one row per agency whose {@code service_area}
 * polygon covers the pickup point. Cars are counted while they sit inside
 * their agency's own zone ({@code coalesce} treats a car without coordinates
 * as parked at the agency base), so a car relocated elsewhere by a one-way
 * trip stops being offered from its home zone.
 */
public interface AgencySearchRepository extends Repository<Car, Long> {

    interface AgencyAggRow {
        Long getAgencyId();

        String getName();

        String getCity();

        Double getLatitude();

        Double getLongitude();

        long getAvailableCars();

        BigDecimal getFromPrice();

        Double getDistanceKm();

        String getServiceAreaGeoJson();
    }

    /** The customer's pickup pin as a WGS84 geography point. */
    String PICKUP = "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography";

    /** Where a car actually is; no coordinates -> parked at the agency base. */
    String CAR_POS = "coalesce(c.geog, ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography)";

    String AGG_SELECT = "select a.id as \"agencyId\", a.name as \"name\", a.city as \"city\", "
            + "a.latitude as \"latitude\", a.longitude as \"longitude\", "
            + "count(c.id) as \"availableCars\", min(c.price_per_day) as \"fromPrice\", "
            + "ST_Distance(ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography, "
            + PICKUP + ") / 1000.0 as \"distanceKm\", "
            + "ST_AsGeoJSON(a.service_area) as \"serviceAreaGeoJson\" "
            + "from agency a join car c on c.agency_id = a.id "
            + "where a.service_area is not null "
            + "  and ST_Covers(a.service_area, " + PICKUP + ") "
            + "  and c.status = 'AVAILABLE' "
            + "  and ST_Covers(a.service_area, " + CAR_POS + ") ";

    String AGG_GROUP = " group by a.id, a.name, a.city, a.latitude, a.longitude, a.service_area "
            + "order by \"distanceKm\" asc nulls last";

    /** Agencies whose zone covers the pickup pin (no date window). */
    @Query(value = AGG_SELECT + AGG_GROUP, nativeQuery = true)
    List<AgencyAggRow> agenciesCovering(
            @Param("lat") double lat,
            @Param("lng") double lng);

    /** Same, but only counting cars actually free for the requested window. */
    @Query(value = AGG_SELECT
            + " and not exists (select 1 from booking b where b.car_id = c.id"
            + "   and b.status in (:blocking) and b.start_ts < :to and b.end_ts > :from)"
            + AGG_GROUP, nativeQuery = true)
    List<AgencyAggRow> agenciesCoveringBetween(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            @Param("blocking") Collection<String> blocking);
}
