-- V5: idempotency for booking creation.
-- A client sends an Idempotency-Key; the same (user, key) must map to exactly
-- one booking, so a retried/double-clicked request never creates a duplicate.
-- Partial unique index: only enforced when a key is present (most internal
-- bookings carry none).
CREATE UNIQUE INDEX uq_booking_idempotency
    ON booking (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
