package com.carrental.document;

import com.carrental.document.dto.DocumentResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Platform-admin document review (Task #37). Guarded two ways like the rest of
 * {@code /api/admin/**}: the URL rule in SecurityConfig plus {@code @PreAuthorize}.
 * Verifying/rejecting a KYC document also moves the owning user's {@code kycStatus}.
 *   GET  /api/admin/documents?status=PENDING
 *   POST /api/admin/documents/{id}/verify
 *   POST /api/admin/documents/{id}/reject
 */
@RestController
@RequestMapping("/api/admin/documents")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class AdminDocumentController {

    private final DocumentService documents;

    public AdminDocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @GetMapping
    public List<DocumentResponse> list(@RequestParam(required = false) DocumentStatus status) {
        return documents.listByStatus(status);
    }

    @PostMapping("/{id}/verify")
    public DocumentResponse verify(@PathVariable Long id, @RequestParam(required = false) String note) {
        return documents.review(id, true, note);
    }

    @PostMapping("/{id}/reject")
    public DocumentResponse reject(@PathVariable Long id, @RequestParam(required = false) String note) {
        return documents.review(id, false, note);
    }
}
