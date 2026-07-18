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

    /** Can anyone run the WHOLE route? One zone must contain both ends. */
    @GetMapping("/api/service-areas/covers-route")
    public RouteCoverageResponse coversRoute(@RequestParam double plat, @RequestParam double plng,
                                             @RequestParam double dlat, @RequestParam double dlng) {
        long agencies = serviceAreas.routeCoverage(plat, plng, dlat, dlng);
        return new RouteCoverageResponse(agencies > 0, agencies);
    }

    public record CoversResponse(boolean covered) {
    }

    public record RouteCoverageResponse(boolean covered, long agencies) {
    }
}
