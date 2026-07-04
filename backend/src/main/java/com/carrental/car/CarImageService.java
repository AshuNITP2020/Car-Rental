package com.carrental.car;

import com.carrental.car.dto.CarImageResponse;
import com.carrental.storage.ObjectStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Car image gallery management. Agency operations are tenant-scoped —
 * a car is only touchable through the caller's own agency — while the customer
 * read is open to any authenticated user. Bytes go to {@link ObjectStorage}
 * (local disk by default, S3/R2 behind config); this table stays the source of
 * truth for order and content type.
 */
@Service
public class CarImageService {

    private static final Logger log = LoggerFactory.getLogger(CarImageService.class);

    /** Keep a gallery bounded, and reject non-image uploads early. */
    private static final int MAX_IMAGES_PER_CAR = 10;
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif");

    private final CarRepository cars;
    private final CarImageRepository images;
    private final ObjectStorage storage;

    public CarImageService(CarRepository cars, CarImageRepository images, ObjectStorage storage) {
        this.cars = cars;
        this.images = images;
        this.storage = storage;
    }

    @Transactional
    public CarImageResponse upload(Long agencyId, Long carId, MultipartFile file) {
        Car car = requireOwnedCar(agencyId, carId);

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String ext = ALLOWED_TYPES.get(contentType);
        if (ext == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported image type; allowed: JPEG, PNG, WebP, GIF");
        }
        long existing = images.countByCar_Id(carId);
        if (existing >= MAX_IMAGES_PER_CAR) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A car can have at most " + MAX_IMAGES_PER_CAR + " images");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded file");
        }

        // Unguessable, car-scoped key. Store bytes first, then the metadata row —
        // so a row never references an object that isn't there.
        String key = "cars/" + carId + "/" + UUID.randomUUID() + ext;
        storage.put(key, bytes, contentType);

        CarImage image = new CarImage();
        image.setCar(car);
        image.setObjectKey(key);
        image.setContentType(contentType);
        image.setSizeBytes(bytes.length);
        image.setPosition((int) existing);   // append at the end of the gallery
        images.save(image);

        return CarImageResponse.from(image, storage.url(key));
    }

    @Transactional(readOnly = true)
    public List<CarImageResponse> listForAgency(Long agencyId, Long carId) {
        requireOwnedCar(agencyId, carId);
        return gallery(carId);
    }

    @Transactional(readOnly = true)
    public List<CarImageResponse> listForCustomer(Long carId) {
        if (!cars.existsById(carId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found");
        }
        return gallery(carId);
    }

    @Transactional
    public void delete(Long agencyId, Long carId, Long imageId) {
        requireOwnedCar(agencyId, carId);
        CarImage image = images.findByIdAndCar_Id(imageId, carId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found"));
        images.delete(image);
        // Remove the object after the row. If the object delete fails we keep going:
        // an orphaned object is harmless (and cheaper to sweep later than to leave a
        // dangling row pointing at a missing file).
        try {
            storage.delete(image.getObjectKey());
        } catch (RuntimeException e) {
            log.warn("Removed car_image {} but its object {} may remain: {}",
                    imageId, image.getObjectKey(), e.getMessage());
        }
    }

    private List<CarImageResponse> gallery(Long carId) {
        return images.findByCar_IdOrderByPositionAscIdAsc(carId).stream()
                .map(image -> CarImageResponse.from(image, storage.url(image.getObjectKey())))
                .toList();
    }

    /** Loads a car only within the tenant; 404 otherwise (no cross-tenant access). */
    private Car requireOwnedCar(Long agencyId, Long carId) {
        return cars.findByIdAndAgency_Id(carId, agencyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
    }
}
