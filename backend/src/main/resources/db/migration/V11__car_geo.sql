-- V11: PostGIS geo column for "cars near me" proximity search.
--
-- We add a geography(Point, 4326) column to `car`, derived from its lon/lat:
--   * geography (not geometry) so ST_Distance / ST_DWithin do great-circle math
--     in METRES on the WGS84 spheroid out of the box — no projection juggling,
--     which is exactly what "cars within N km of me" needs.
--   * SRID 4326 = ordinary GPS latitude/longitude.
--
-- It's a STORED GENERATED column: Postgres recomputes it from longitude/latitude
-- on every insert/update, so it can never drift from the source coordinates and
-- the app never sets it (the Car entity doesn't even map it; Hibernate `validate`
-- ignores unmapped columns). ST_MakePoint/ST_SetSRID are STRICT, so a row missing
-- either coordinate yields NULL here and is simply skipped by proximity search.
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE car
    ADD COLUMN geog geography(Point, 4326)
        GENERATED ALWAYS AS (
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        ) STORED;

-- GiST index makes the radius filter (ST_DWithin) and nearest-neighbour ordering
-- (the <-> operator) index-assisted instead of scanning the whole fleet.
CREATE INDEX idx_car_geog ON car USING gist (geog);
