package com.carrental.storage;

import java.util.Optional;

/**
 * Abstraction over where car-image bytes physically live. The default
 * {@link LocalObjectStorage} writes to disk with zero setup; {@link S3ObjectStorage}
 * (active when {@code app.storage.provider=s3}) targets S3 / Cloudflare R2 / MinIO.
 * Same swap-behind-config pattern as the payment gateway and notification sender.
 *
 * <p>The caller (CarImageService) decides the {@code key} — a stable, unguessable
 * path like {@code cars/42/<uuid>.jpg}; storage just puts/serves/deletes bytes
 * under it.
 */
public interface ObjectStorage {

    /** Provider name, for logging/diagnostics (e.g. "LOCAL", "S3"). */
    String name();

    /** Stores {@code content} under {@code key}, overwriting any existing object. */
    void put(String key, byte[] content, String contentType);

    /**
     * A URL a client can GET the object from: an app-served path for the local
     * provider, or a short-lived presigned URL for S3/R2.
     */
    String url(String key);

    /** Removes the object; a no-op if it doesn't exist. */
    void delete(String key);

    /**
     * Raw bytes for the object, or empty if absent. Used by the local media
     * endpoint to stream files; S3 clients fetch the presigned {@link #url} directly.
     */
    Optional<byte[]> getBytes(String key);
}
