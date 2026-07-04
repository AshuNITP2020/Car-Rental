package com.carrental.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Verifies the {@code s3} storage provider end-to-end against the local MinIO
 * (docker-compose). Overriding {@code app.storage.provider=s3} activates
 * {@link S3ObjectStorage} instead of the default local one. The test self-skips
 * when MinIO isn't running, so it never breaks a normal (local-provider) run —
 * start it with {@code docker compose up -d minio createbuckets}.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "app.storage.provider=s3",
        "app.storage.s3.endpoint=http://localhost:9000",
        "app.storage.s3.bucket=car-images",
        "app.storage.s3.region=us-east-1",
        "app.storage.s3.access-key=minioadmin",
        "app.storage.s3.secret-key=minioadmin",
        "app.storage.s3.presign-seconds=300"
})
class S3ObjectStorageTest {

    @Autowired ObjectStorage storage;

    @BeforeEach
    void requireMinio() {
        assumeTrue(reachable("localhost", 9000),
                "MinIO not running on :9000 — `docker compose up -d minio createbuckets`");
    }

    @Test
    void s3ProviderIsActive() {
        assertEquals("S3", storage.name());   // proves the s3 bean, not local, is wired
    }

    @Test
    void putGetUrlDelete_againstMinio() {
        String key = "it/" + UUID.randomUUID() + ".bin";
        byte[] bytes = "minio-round-trip".getBytes();

        storage.put(key, bytes, "application/octet-stream");
        assertArrayEquals(bytes, storage.getBytes(key).orElseThrow());
        assertTrue(storage.url(key).contains("car-images"), storage.url(key)); // presigned bucket URL

        storage.delete(key);
        assertTrue(storage.getBytes(key).isEmpty());
    }

    private static boolean reachable(String host, int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 500);
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}
