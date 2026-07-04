package com.carrental.car;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CarImageRepository extends JpaRepository<CarImage, Long> {

    /** A car's gallery in display order. */
    List<CarImage> findByCar_IdOrderByPositionAscIdAsc(Long carId);

    /** One image, but only if it belongs to the given car (tenant-safe lookup). */
    Optional<CarImage> findByIdAndCar_Id(Long id, Long carId);

    /** Used to append a new image at the end of the gallery. */
    long countByCar_Id(Long carId);

    /** Metadata by storage key — the media endpoint uses it for content type + existence. */
    Optional<CarImage> findByObjectKey(String objectKey);
}
