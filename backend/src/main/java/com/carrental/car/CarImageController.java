package com.carrental.car;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.carrental.car.dto.CarImageResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Customer-facing read of a car's image gallery — any authenticated
 * user, cross-tenant, mirroring how car search is open to all logged-in users.
 * Returns each image's fetch URL (app-served for local storage, presigned for S3).
 *   GET /api/cars/{carId}/images
 */
@Tag(name = "Car images", description = "Public car photos for customers")
@RestController
public class CarImageController {

    private final CarImageService imageService;

    public CarImageController(CarImageService imageService) {
        this.imageService = imageService;
    }

    @GetMapping("/api/cars/{carId}/images")
    public List<CarImageResponse> list(@PathVariable Long carId) {
        return imageService.listForCustomer(carId);
    }
}
