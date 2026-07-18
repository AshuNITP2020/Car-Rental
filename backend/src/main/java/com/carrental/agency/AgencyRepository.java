package com.carrental.agency;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AgencyRepository extends JpaRepository<Agency, Long> {

    /** Seed idempotency: has a (corridor) agency of this exact name been created? */
    boolean existsByName(String name);

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

    /** One row per agency for the admin review screen. */
    interface AdminAgencyRow {
        Long getId();

        String getName();

        String getCity();

        String getStatus();

        String getOwnerEmail();

        boolean getHasZone();

        long getCars();
    }

    /**
     * Admin approval queue: PENDING agencies first (newest on top), then the
     * rest. {@code hasZone}/{@code cars} tell the reviewer whether the agency
     * has finished onboarding (drawn an area, listed cars) before approving.
     */
    @Query(value = """
            select a.id as "id", a.name as "name", a.city as "city",
                   a.status as "status", u.email as "ownerEmail",
                   (a.service_area is not null) as "hasZone",
                   (select count(*) from car c where c.agency_id = a.id) as "cars"
            from agency a join users u on u.id = a.owner_id
            order by case a.status when 'PENDING' then 0 when 'ACTIVE' then 1 else 2 end,
                     a.created_at desc
            """, nativeQuery = true)
    List<AdminAgencyRow> adminList();
}
