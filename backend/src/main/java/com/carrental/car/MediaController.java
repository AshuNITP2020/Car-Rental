package com.carrental.car;

import com.carrental.storage.ObjectStorage;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;

/**
 * Serves stored image bytes for the LOCAL storage provider (Task #36) — the URLs
 * {@code LocalObjectStorage} hands out point here. Only keys that actually have a
 * {@code car_image} row are served (so this can't read arbitrary files off disk),
 * and the content type comes from that row. With {@code app.storage.provider=s3},
 * clients fetch presigned bucket URLs directly and never hit this endpoint.
 */
@RestController
public class MediaController {

    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    private final ObjectStorage storage;
    private final CarImageRepository images;

    public MediaController(ObjectStorage storage, CarImageRepository images) {
        this.storage = storage;
        this.images = images;
    }

    @GetMapping("/api/media/**")
    public ResponseEntity<byte[]> serve(HttpServletRequest request) {
        String key = PATH_MATCHER.extractPathWithinPattern("/api/media/**", request.getRequestURI());

        CarImage meta = images.findByObjectKey(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
        byte[] bytes = storage.getBytes(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(meta.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .body(bytes);
    }
}
