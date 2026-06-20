package com.carrental.user;

/**
 * Platform-wide role of a user. Distinct from the agency-scoped role
 * (AgencyRole ADMIN/STAFF) a user may hold within a specific agency.
 * Persisted as its name; surfaces as a Spring authority "ROLE_<name>".
 */
public enum UserRole {
    CUSTOMER,
    PLATFORM_ADMIN
}
