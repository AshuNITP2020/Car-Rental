-- V2: platform-level role on a user (distinct from the agency-scoped role in
-- agency_member). Most users are CUSTOMER; PLATFORM_ADMIN is the superuser.
-- Existing rows default to CUSTOMER.
ALTER TABLE users
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER'
        CHECK (role IN ('CUSTOMER', 'PLATFORM_ADMIN'));

CREATE INDEX idx_users_role ON users (role);
