-- V4: optimistic-locking version counter on car (Task #17).
-- Each booking force-increments this; two concurrent bookings for the same car
-- then conflict (UPDATE ... WHERE version = ? matches only one), so the loser
-- gets an optimistic-lock failure and retries. Existing rows start at 0.
ALTER TABLE car ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
