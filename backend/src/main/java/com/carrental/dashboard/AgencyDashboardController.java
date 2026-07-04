package com.carrental.dashboard;

import com.carrental.auth.TenantContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The agency's own analytics dashboard. Scoped to the caller's agency
 * from the token (any member may view it), so an agency only ever sees its own
 * fleet, bookings, and revenue.
 *   GET /api/agency/dashboard
 */
@RestController
@RequestMapping("/api/agency/dashboard")
public class AgencyDashboardController {

    private final DashboardService dashboard;

    public AgencyDashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    public AgencyDashboardResponse get() {
        return dashboard.forAgency(TenantContext.requireAgencyId());
    }
}
