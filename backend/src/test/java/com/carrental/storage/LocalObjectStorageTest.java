package com.carrental.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * the default local object storage — plain unit test against a temp
 * directory (no Spring), covering the put/get/url/delete round trip and the
 * path-traversal guard that protects the media endpoint.
 */
class LocalObjectStorageTest {

    @Test
    void putGetUrlDelete_roundTrip(@TempDir Path dir) {
        LocalObjectStorage storage = new LocalObjectStorage(dir.toString(), "/api/media");
        byte[] bytes = "fake-jpeg-bytes".getBytes();
        String key = "cars/7/photo.jpg";

        storage.put(key, bytes, "image/jpeg");

        assertTrue(storage.getBytes(key).isPresent());
        assertArrayEquals(bytes, storage.getBytes(key).get());
        assertEquals("/api/media/cars/7/photo.jpg", storage.url(key));

        storage.delete(key);
        assertTrue(storage.getBytes(key).isEmpty());
    }

    @Test
    void getMissingKey_isEmpty(@TempDir Path dir) {
        LocalObjectStorage storage = new LocalObjectStorage(dir.toString(), "/api/media");
        assertTrue(storage.getBytes("cars/1/nope.jpg").isEmpty());
    }

    @Test
    void keyEscapingTheRoot_isRejected(@TempDir Path dir) {
        LocalObjectStorage storage = new LocalObjectStorage(dir.toString(), "/api/media");
        // A crafted key must never escape the storage directory.
        assertThrows(ResponseStatusException.class,
                () -> storage.getBytes("../../../../etc/passwd"));
    }
}
