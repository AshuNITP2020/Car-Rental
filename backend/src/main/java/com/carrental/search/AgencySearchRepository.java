package com.carrental.search;

import com.carrental.booking.BookingStatus;
import com.carrental.car.Car;
import com.carrental.car.CarStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Cross-tenant, read-only aggregate over agencies for the trip-first flow:
 * "which agencies operate at my pickup city, and what do they offer?" One row
 * per agency with its available-car count and cheapest daily rate. Cars are
 * matched on where they ARE ({@code coalesce(current_city, agency.city)}), so a
 * car left in another city by a one-way trip is offered from there.
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
    }

    String AGG_SELECT = """
            select a.id as agencyId, a.name as name, a.city as city,
                   a.latitude as latitude, a.longitude as longitude,
                   count(c) as availableCars, min(c.pricePerDay) as fromPrice
            from Car c join c.agency a
            where c.status = :available
              and lower(coalesce(c.currentCity, a.city)) = :city
            """;

    String AGG_GROUP = """
             group by a.id, a.name, a.city, a.latitude, a.longitude
             order by count(c) desc
            """;

    /** Agencies with at least one AVAILABLE car in the city (no date window). */
    @Query(AGG_SELECT + AGG_GROUP)
    List<AgencyAggRow> agenciesInCity(
            @Param("available") CarStatus available,
            @Param("city") String city);

    /** Same, but only counting cars actually free for the requested window. */
    @Query(AGG_SELECT
            + " and not exists (select 1 from Booking b where b.car = c"
            + " and b.status in :blocking and b.startTs < :to and b.endTs > :from)"
            + AGG_GROUP)
    List<AgencyAggRow> agenciesInCityBetween(
            @Param("available") CarStatus available,
            @Param("city") String city,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            @Param("blocking") Collection<BookingStatus> blocking);
}
