-- V15: Trip-first booking (Uber-style flow: pickup city -> drop city).
--   * booking gains a trip type (round trip vs one-way drop-off), the pickup /
--     drop cities, and the one-way relocation fee charged to the customer.
--   * car gains current_city: where the car actually is right now — a completed
--     one-way trip leaves it at the drop city. Backfilled from the owning agency.

ALTER TABLE booking
    ADD COLUMN trip_type   VARCHAR(20)   NOT NULL DEFAULT 'ROUND_TRIP'
        CHECK (trip_type IN ('ROUND_TRIP', 'ONE_WAY')),
    ADD COLUMN pickup_city VARCHAR(100),
    ADD COLUMN drop_city   VARCHAR(100),
    ADD COLUMN one_way_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE car ADD COLUMN current_city VARCHAR(100);

-- Every car starts where its agency is.
UPDATE car c SET current_city = a.city FROM agency a WHERE a.id = c.agency_id;

-- City search matches case-insensitively (mirrors the lower(...) car indexes).
CREATE INDEX idx_car_current_city ON car (lower(current_city));
