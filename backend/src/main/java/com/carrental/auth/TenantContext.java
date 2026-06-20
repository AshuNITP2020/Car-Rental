package com.carrental.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

/**
 * Reads the current tenant from the security context. The single source of
 * truth for "which agency is this request acting for?" — derived from the
 * signed token, never from anything the client sends.
 */
public final class TenantContext {

    private TenantContext() {
    }

    public static AuthPrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return principal;
    }

    /** The current agency id, or 403 if the caller belongs to no agency. */
    public static Long requireAgencyId() {
        Long agencyId = currentPrincipal().agencyId();
        if (agencyId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of any agency");
        }
        return agencyId;
    }

    /** The current agency id, but only if the caller is its ADMIN; else 403. */
    public static Long requireAgencyAdmin() {
        AuthPrincipal principal = currentPrincipal();
        if (principal.agencyId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of any agency");
        }
        if (!"ADMIN".equals(principal.agencyRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires agency admin role");
        }
        return principal.agencyId();
    }
}
