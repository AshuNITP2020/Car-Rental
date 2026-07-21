package com.carrental.agency;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.auth.TenantContext;
import com.carrental.agency.dto.ServiceAreaCitiesRequest;
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
 *   GET /api/agencies/me/service-area         the caller's zone (tenant-scoped)
 *   PUT /api/agencies/me/service-area         CUSTOM mode: hand-drawn polygon
 *   PUT /api/agencies/me/service-area/cities  CITIES mode: circles around picked
 *                                             cities (scattered parts allowed)
 *   GET /api/service-areas/covers?lat&lng     is a map point serviced by anyone?
 *   GET /api/service-areas/covers-route       can one zone run the whole route?
 */
@Tag(name = "Service areas", description = "Agency operating areas (may be scattered) + public coverage checks for map pins and whole routes")
@RestController
public class ServiceAreaController {

    private final ServiceAreaService serviceAreas;

    public ServiceAreaController(ServiceAreaService serviceAreas) {
        this.serviceAreas = serviceAreas;
    }

    @GetMapping("/api/agencies/me/service-area")
    public ServiceAreaResponse mine() {
        return serviceAreas.get(TenantContext.requireAgencyId());
    }

    @Operation(summary = "Replace the area with a hand-drawn polygon (CUSTOM mode)")
    @PutMapping("/api/agencies/me/service-area")
    public ServiceAreaResponse update(@Valid @RequestBody ServiceAreaRequest req) {
        return serviceAreas.updateCustom(TenantContext.requireAgencyAdmin(), req.polygon());
    }

    @Operation(summary = "Rebuild the area from picked cities (CITIES mode)",
            description = "A radius circle around each city; distant circles stay separate parts (scattered areas are fine).")
    @PutMapping("/api/agencies/me/service-area/cities")
    public ServiceAreaResponse updateCities(@Valid @RequestBody ServiceAreaCitiesRequest req) {
        return serviceAreas.updateFromCities(TenantContext.requireAgencyAdmin(), req);
    }

    @Operation(summary = "Is a point inside ANY live agency's area?")
    @GetMapping("/api/service-areas/covers")
    public CoversResponse covers(@RequestParam double lat, @RequestParam double lng) {
        return new CoversResponse(serviceAreas.isCovered(lat, lng));
    }

    /** Can anyone run the WHOLE route? One zone must contain both ends. */
    @Operation(summary = "Can one agency run the whole route?",
            description = "Counts live agencies whose single area contains BOTH points.")
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
