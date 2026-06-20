package com.carrental.auth;

/**
 * The authenticated caller, reconstructed from the access token on each request
 * and stored as the Spring Security principal.
 *
 * @param userId      who they are
 * @param role        platform role (CUSTOMER / PLATFORM_ADMIN)
 * @param agencyId    the tenant they act for, or null if they belong to no agency
 * @param agencyRole  their role within that agency (ADMIN / STAFF), or null
 */
public record AuthPrincipal(Long userId, String role, Long agencyId, String agencyRole) {
}
