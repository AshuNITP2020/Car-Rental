-- V16: Agency operating areas + point-based trips (map pickup/drop).
--
--   * agency.service_area — the zone this agency operates in, as a WGS84
--     geography POLYGON. An agency appears in trip searches only when the
--     customer's pickup pin falls inside this area (ST_Covers). Like car.geog
--     (V11), the column is NOT mapped by Hibernate — all reads/writes go
--     through native SQL (GeoJSON in/out), so no hibernate-spatial dependency.
--   * booking pickup/drop coordinates — trips are now between map points, not
--     city names. The existing pickup_city/drop_city columns remain as
--     human-readable labels (nearest operating city).
--
-- Backfill: existing agencies with coordinates get a ~25 km circular zone
-- around their base so the marketplace keeps working the moment this ships;
-- agencies refine their real area from the console.

ALTER TABLE agency ADD COLUMN service_area geography(Polygon, 4326);

UPDATE agency
SET service_area = ST_Buffer(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography, 25000)::geography(Polygon,4326)
WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

CREATE INDEX idx_agency_service_area ON agency USING gist (service_area);

ALTER TABLE booking
    ADD COLUMN pickup_lat DOUBLE PRECISION,
    ADD COLUMN pickup_lng DOUBLE PRECISION,
    ADD COLUMN drop_lat   DOUBLE PRECISION,
    ADD COLUMN drop_lng   DOUBLE PRECISION;
