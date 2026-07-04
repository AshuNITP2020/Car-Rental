package com.carrental.car.dto;

import com.carrental.car.CarImage;

/**
 * One image in a car's gallery, as returned to clients (Task #36). {@code url}
 * is where to fetch the bytes — an app-served path for the local provider, or a
 * presigned S3/R2 URL when {@code app.storage.provider=s3}.
 */
public record CarImageResponse(
        Long id,
        Long carId,
        String url,
        String contentType,
        long sizeBytes,
        int position
) {
    public static CarImageResponse from(CarImage image, String url) {
        return new CarImageResponse(
                image.getId(),
                image.getCar().getId(),
                url,
                image.getContentType(),
                image.getSizeBytes(),
                image.getPosition());
    }
}
