package com.carrental.agency;

import com.carrental.auth.TenantContext;
import com.carrental.agency.dto.ServiceAreaRequest;
import com.carrental.agency.dto.ServiceAreaResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agency operating areas.
 *   GET /api/agencies/me/service-area      the caller's zone (tenant-scoped)
 *   PUT /api/agencies/me/service-area      draw/replace it (agency ADMIN)
 *   GET /api/service-areas/covers?lat&lng  is a map point serviced by anyone?
 *                                          (trip form pin feedback + drop check)
 */
@RestController
public class ServiceAreaController {

    private final ServiceAreaService serviceAreas;

    public ServiceAreaController(ServiceAreaService serviceAreas) {
        this.serviceAreas = serviceAreas;
    }

    @GetMapping("/api/agencies/me/service-area")
    public ServiceAreaResponse mine() {
        return new ServiceAreaResponse(
                serviceAreas.get(TenantContext.requireAgencyId()).orElse(null));
    }

    @PutMapping("/api/agencies/me/service-area")
    public ServiceAreaResponse update(@Valid @RequestBody ServiceAreaRequest req) {
        return new ServiceAreaResponse(
                serviceAreas.update(TenantContext.requireAgencyAdmin(), req.polygon()));
    }

    @GetMapping("/api/service-areas/covers")
    public CoversResponse covers(@RequestParam double lat, @RequestParam double lng) {
        return new CoversResponse(serviceAreas.isCovered(lat, lng));
    }

    public record CoversResponse(boolean covered) {
    }
}
