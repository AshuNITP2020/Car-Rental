package com.carrental.car;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.auth.TenantContext;
import com.carrental.car.dto.CarImageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Agency-facing management of a car's image gallery, tenant-scoped via
 * the token — an agency can only touch its own cars' images. Upload is a
 * multipart form field named {@code file}.
 *   POST   /api/agency/cars/{carId}/images   (multipart: file)
 *   GET    /api/agency/cars/{carId}/images
 *   DELETE /api/agency/cars/{carId}/images/{imageId}
 */
@Tag(name = "Fleet images", description = "Car photo upload, cover selection and removal")
@RestController
@RequestMapping("/api/agency/cars/{carId}/images")
public class AgencyCarImageController {

    private final CarImageService imageService;

    public AgencyCarImageController(CarImageService imageService) {
        this.imageService = imageService;
    }

    @PostMapping
    public ResponseEntity<CarImageResponse> upload(@PathVariable Long carId,
                                                   @RequestParam("file") MultipartFile file) {
        CarImageResponse created = imageService.upload(TenantContext.requireAgencyId(), carId, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public List<CarImageResponse> list(@PathVariable Long carId) {
        return imageService.listForAgency(TenantContext.requireAgencyId(), carId);
    }

    @DeleteMapping("/{imageId}")
    public ResponseEntity<Void> delete(@PathVariable Long carId, @PathVariable Long imageId) {
        imageService.delete(TenantContext.requireAgencyId(), carId, imageId);
        return ResponseEntity.noContent().build();
    }

    /** Make an image the gallery cover (position 0). Returns the reordered gallery. */
    @PutMapping("/{imageId}/cover")
    public List<CarImageResponse> setCover(@PathVariable Long carId, @PathVariable Long imageId) {
        return imageService.setCover(TenantContext.requireAgencyId(), carId, imageId);
    }
}
