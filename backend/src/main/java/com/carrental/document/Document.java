package com.carrental.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

/**
 * A private document: KYC (owned by a user) or car insurance/
 * registration (owned by a car). The bytes live in object storage under
 * {@code objectKey}; access is always mediated by an authorization check — see
 * {@link DocumentService}. {@code ownerId} is polymorphic (a user id or a car id
 * per {@code ownerType}), so it has no FK.
 */
@Entity
@Table(name = "document")
@Getter
@Setter
@NoArgsConstructor
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "owner_type", nullable = false, length = 20)
    private DocumentOwnerType ownerType;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, length = 30)
    private DocumentType docType;

    @Column(name = "object_key", nullable = false, length = 300)
    private String objectKey;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentStatus status = DocumentStatus.PENDING;

    /** The user who uploaded this (FK to users). */
    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    /** Optional note left by a reviewing admin (reason for rejection, etc.). */
    @Column(name = "review_note", length = 500)
    private String reviewNote;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
