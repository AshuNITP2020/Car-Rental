package com.carrental.admin;

import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyService;
import com.carrental.agency.AgencyStatus;
import com.carrental.agency.dto.AgencyResponse;
import com.carrental.auth.dto.UserResponse;
import com.carrental.user.UserRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Platform-admin-only endpoints. Guarded two ways (defense in depth):
 *  - URL rule in SecurityConfig: /api/admin/** requires ROLE_PLATFORM_ADMIN
 *  - @PreAuthorize on the method (method-level guard)
 * A CUSTOMER token here yields 403.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository users;
    private final AgencyRepository agencies;
    private final AgencyService agencyService;

    public AdminController(UserRepository users, AgencyRepository agencies,
                           AgencyService agencyService) {
        this.users = users;
        this.agencies = agencies;
        this.agencyService = agencyService;
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public List<UserResponse> listUsers() {
        return users.findAll().stream().map(UserResponse::from).toList();
    }

    /** The agency review queue: PENDING first, with onboarding completeness. */
    @GetMapping("/agencies")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public List<AgencyRepository.AdminAgencyRow> listAgencies() {
        return agencies.adminList();
    }

    /** Approve: the agency goes live and appears in customer searches. */
    @PostMapping("/agencies/{id}/approve")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public AgencyResponse approve(@PathVariable Long id) {
        return agencyService.updateStatus(id, AgencyStatus.ACTIVE);
    }

    /** Suspend: immediately invisible to customers; existing bookings stand. */
    @PostMapping("/agencies/{id}/suspend")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public AgencyResponse suspend(@PathVariable Long id) {
        return agencyService.updateStatus(id, AgencyStatus.SUSPENDED);
    }
}
