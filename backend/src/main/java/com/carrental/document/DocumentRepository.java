package com.carrental.document;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    /** All documents for one owner (a user's KYC docs, or a car's papers), oldest first. */
    List<Document> findByOwnerTypeAndOwnerIdOrderByIdAsc(DocumentOwnerType ownerType, Long ownerId);

    /** Admin review queue, filtered by state. */
    List<Document> findByStatusOrderByIdAsc(DocumentStatus status);
}
