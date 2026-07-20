-- V18: cars get a seat count — customers filter by car TYPE + seats, not by
-- make/model. Existing rows are backfilled from their category (the seed's
-- categories map naturally); agencies can correct per car from the console.

ALTER TABLE car ADD COLUMN seats INT NOT NULL DEFAULT 5;

UPDATE car SET seats = CASE upper(category)
    WHEN 'HATCHBACK' THEN 4
    WHEN 'SUV'       THEN 7
    WHEN 'MPV'       THEN 7
    WHEN 'VAN'       THEN 8
    ELSE 5   -- SEDAN, LUXURY, anything custom
END;
