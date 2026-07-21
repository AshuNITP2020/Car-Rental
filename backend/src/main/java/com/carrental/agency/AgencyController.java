package com.carrental.agency;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.agency.dto.AgencyResponse;
import com.carrental.agency.dto.CreateAgencyRequest;
import com.carrental.agency.dto.UpdateAgencyRequest;
import com.carrental.auth.AuthPrincipal;
import com.carrental.auth.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Agencies", description = "Agency onboarding and profile (tenant-scoped \u201cme\u201d endpoints + public profile)")
@RestController
@RequestMapping("/api/agencies")
public class AgencyController {

    private final AgencyService agencyService;

    public AgencyController(AgencyService agencyService) {
        this.agencyService = agencyService;
    }

    /** Any authenticated user can create an agency; they become its ADMIN. */
    @PostMapping
    public ResponseEntity<AgencyResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                                 @Valid @RequestBody CreateAgencyRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(agencyService.create(principal.userId(), req));
    }

    /** The caller's own agency (tenant from the token). */
    @GetMapping("/me")
    public AgencyResponse myAgency() {
        return agencyService.get(TenantContext.requireAgencyId());
    }

    /** Update the caller's own agency — agency ADMIN only. */
    @PutMapping("/me")
    public AgencyResponse updateMyAgency(@Valid @RequestBody UpdateAgencyRequest req) {
        return agencyService.update(TenantContext.requireAgencyAdmin(), req);
    }

    /** Read any agency by id (authenticated). */
    @GetMapping("/{id}")
    public AgencyResponse getById(@PathVariable Long id) {
        return agencyService.get(id);
    }
}
