package com.carrental.agency;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Native SQL access to {@code agency.service_area} (a PostGIS geography
 * polygon). Like {@code car.geog}, the column is deliberately NOT mapped on the
 * entity — GeoJSON goes in/out through these queries, so we need no
 * hibernate-spatial dependency and Hibernate's schema validation ignores it.
 */
public interface ServiceAreaRepository extends Repository<Agency, Long> {

    /** The agency's zone as a GeoJSON (Multi)Polygon string, if set. */
    @Query(value = "select ST_AsGeoJSON(service_area) from agency where id = :id", nativeQuery = true)
    Optional<String> serviceAreaGeoJson(@Param("id") Long id);

    /** How the zone was defined (jsonb: mode/cities/radius), if set. */
    @Query(value = "select service_area_def::text from agency where id = :id", nativeQuery = true)
    Optional<String> serviceAreaDef(@Param("id") Long id);

    /** Custom mode: a hand-drawn polygon (wrapped to MultiPolygon). */
    @Modifying
    @Query(value = "update agency set"
            + " service_area = ST_Multi(ST_GeomFromGeoJSON(:geojson))::geography,"
            + " service_area_def = cast(:def as jsonb)"
            + " where id = :id", nativeQuery = true)
    int updateServiceArea(@Param("id") Long id, @Param("geojson") String geojson,
                          @Param("def") String def);

    /**
     * Cities mode: buffer every picked city centroid (a GeoJSON MultiPoint) by
     * {@code radiusM}. Buffering the MultiPoint as geography yields the UNION
     * of the circles in one call — overlapping ones merge, distant ones stay
     * separate parts of the MultiPolygon (scattered areas are fine).
     */
    @Modifying
    @Query(value = "update agency set"
            + " service_area = ST_Multi(ST_Buffer(ST_GeomFromGeoJSON(:multiPoint)::geography,"
            + "                                   :radiusM)::geometry)::geography,"
            + " service_area_def = cast(:def as jsonb)"
            + " where id = :id", nativeQuery = true)
    int updateServiceAreaFromCities(@Param("id") Long id, @Param("multiPoint") String multiPoint,
                                    @Param("radiusM") double radiusM, @Param("def") String def);

    /**
     * Ring sanity: a valid simple polygon (no self-intersection) with a sane
     * area (≤ ~250 km-radius circle, so nobody claims a continent).
     */
    @Query(value = "select ST_IsValid(ST_GeomFromGeoJSON(:geojson))"
            + " and ST_Area(ST_GeomFromGeoJSON(:geojson)::geography) <= 2.0e11", nativeQuery = true)
    boolean isAcceptablePolygon(@Param("geojson") String geojson);

    /** Is this map point inside ANY live agency's operating area? (pin badge) */
    @Query(value = "select exists(select 1 from agency where service_area is not null"
            + " and status = 'ACTIVE'"
            + " and ST_Covers(service_area, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography))",
            nativeQuery = true)
    boolean anyAgencyCovers(@Param("lat") double lat, @Param("lng") double lng);

    /** Does THIS agency's zone cover the point? (one-way drop must stay in-zone) */
    @Query(value = "select exists(select 1 from agency where id = :agencyId"
            + " and service_area is not null"
            + " and ST_Covers(service_area, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography))",
            nativeQuery = true)
    boolean agencyCovers(@Param("agencyId") Long agencyId,
                         @Param("lat") double lat, @Param("lng") double lng);

    /**
     * How many live agencies could run the WHOLE route — their single zone
     * covers pickup and drop. Cars never leave their agency's area, so a trip
     * is only offerable when one polygon contains both ends.
     */
    @Query(value = "select count(*) from agency where service_area is not null"
            + " and status = 'ACTIVE'"
            + " and ST_Covers(service_area, ST_SetSRID(ST_MakePoint(:plng, :plat), 4326)::geography)"
            + " and ST_Covers(service_area, ST_SetSRID(ST_MakePoint(:dlng, :dlat), 4326)::geography)",
            nativeQuery = true)
    long countCoveringRoute(@Param("plat") double plat, @Param("plng") double plng,
                            @Param("dlat") double dlat, @Param("dlng") double dlng);
}
