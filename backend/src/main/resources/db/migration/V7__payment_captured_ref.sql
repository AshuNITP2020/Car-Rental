-- V7: store the provider's *payment* id captured via the webhook (Task #24).
-- provider_ref holds the ORDER id (used for webhook lookup); refunds are issued
-- against the PAYMENT id, so we keep it separately.
ALTER TABLE payment ADD COLUMN captured_ref VARCHAR(120);
