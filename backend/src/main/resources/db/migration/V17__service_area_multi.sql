-- V17: Service areas become MULTI-polygons + remember how they were defined.
--
--   * agency.service_area — now geography(MultiPolygon): an agency's area can
--     be SCATTERED (e.g. "we serve Pune and Nagpur", two separate circles),
--     not just one contiguous shape. ST_Covers and the GiST index work
--     unchanged; existing single polygons are wrapped with ST_Multi.
--   * agency.service_area_def — the human definition behind the geometry
--     (mode CITIES: picked cities + radius; mode CUSTOM: hand-drawn), so the
--     console can re-render the picker exactly as the agency left it.
--     The geometry stays the single source of truth for matching.

ALTER TABLE agency
    ALTER COLUMN service_area TYPE geography(MultiPolygon, 4326)
        USING ST_Multi(service_area::geometry)::geography(MultiPolygon, 4326);

ALTER TABLE agency ADD COLUMN service_area_def jsonb;
