package com.carrental.document.dto;

import com.carrental.document.Document;

import java.time.OffsetDateTime;

/**
 * A document as returned to clients. {@code downloadUrl} is the
 * <em>authenticated</em> content endpoint — hitting it re-checks authorization and
 * streams the bytes. It is deliberately NOT a public or presigned URL: private
 * documents are never handed out as a shareable link.
 */
public record DocumentResponse(
        Long id,
        String ownerType,
        Long ownerId,
        String docType,
        String status,
        String contentType,
        long sizeBytes,
        String downloadUrl,
        String reviewNote,
        OffsetDateTime createdAt
) {
    public static DocumentResponse from(Document d) {
        return new DocumentResponse(
                d.getId(),
                d.getOwnerType().name(),
                d.getOwnerId(),
                d.getDocType().name(),
                d.getStatus().name(),
                d.getContentType(),
                d.getSizeBytes(),
                "/api/documents/" + d.getId() + "/content",
                d.getReviewNote(),
                d.getCreatedAt());
    }
}
