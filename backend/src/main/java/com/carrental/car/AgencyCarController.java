package com.carrental.car;

import com.carrental.auth.TenantContext;
import com.carrental.car.dto.CreateCarRequest;
import com.carrental.car.dto.UpdateCarRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Agency-facing fleet management, fully scoped to the caller's tenant.
 * The agency id always comes from the token (TenantContext), never the request,
 * so an agency can only ever see/modify its own cars.
 *   create/read/update -> any agency member
 *   delete             -> agency ADMIN only
 */
@RestController
@RequestMapping("/api/agency/cars")
public class AgencyCarController {

    private final CarService carService;

    public AgencyCarController(CarService carService) {
        this.carService = carService;
    }

    @GetMapping
    public List<CarResponse> list() {
        return carService.list(TenantContext.requireAgencyId());
    }

    @GetMapping("/{id}")
    public CarResponse get(@PathVariable Long id) {
        return carService.get(TenantContext.requireAgencyId(), id);
    }

    @PostMapping
    public ResponseEntity<CarResponse> create(@Valid @RequestBody CreateCarRequest req) {
        CarResponse created = carService.create(TenantContext.requireAgencyId(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public CarResponse update(@PathVariable Long id, @Valid @RequestBody UpdateCarRequest req) {
        return carService.update(TenantContext.requireAgencyId(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        carService.delete(TenantContext.requireAgencyAdmin(), id);  // ADMIN only
        return ResponseEntity.noContent().build();
    }
}
