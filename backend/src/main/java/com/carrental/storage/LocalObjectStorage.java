package com.carrental.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Default object storage: writes image bytes to a local directory (Task #36).
 * Active when {@code app.storage.provider=local} (the default), so the app runs
 * with zero external setup. Objects are served back through the app's media
 * endpoint, so {@link #url} returns a path like {@code /api/media/cars/42/<uuid>.jpg}.
 *
 * <p>Every key is resolved *under* the configured root and re-checked after
 * normalization, so a crafted key (e.g. containing {@code ../}) can never escape
 * the storage directory — important because the media endpoint takes the key from
 * the request path.
 */
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "local", matchIfMissing = true)
public class LocalObjectStorage implements ObjectStorage {

    private final Path root;
    private final String baseUrl;

    public LocalObjectStorage(@Value("${app.storage.local.dir:./data/car-images}") String dir,
                              @Value("${app.storage.local.base-url:/api/media}") String baseUrl) {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    @Override
    public String name() {
        return "LOCAL";
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store object " + key, e);
        }
    }

    @Override
    public String url(String key) {
        return baseUrl + "/" + key;
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to delete object " + key, e);
        }
    }

    @Override
    public Optional<byte[]> getBytes(String key) {
        Path target = resolve(key);
        if (!Files.isRegularFile(target)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(target));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read object " + key, e);
        }
    }

    /** Resolves a key under the root, rejecting anything that escapes it. */
    private Path resolve(String key) {
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid object key");
        }
        return target;
    }
}
