package com.carrental.agency;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AgencyRepository extends JpaRepository<Agency, Long> {

    /** Projection for the operating-cities aggregate. */
    interface CityRow {
        String getCity();

        long getAgencyCount();

        Double getLatitude();

        Double getLongitude();
    }

    /**
     * Every city the marketplace operates in (has at least one agency), with the
     * agency count and a centroid (average of the agencies' coordinates) used for
     * route-distance estimates and one-way fees. Busiest cities first.
     */
    @Query("""
            select a.city as city, count(a) as agencyCount,
                   avg(a.latitude) as latitude, avg(a.longitude) as longitude
            from Agency a
            where a.city is not null
            group by a.city
            order by count(a) desc, a.city asc
            """)
    List<CityRow> operatingCities();
}
