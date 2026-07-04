package com.carrental.document;

import com.carrental.auth.AuthPrincipal;
import com.carrental.auth.TenantContext;
import com.carrental.document.dto.DocumentResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * An agency manages a car's insurance/registration documents,
 * tenant-scoped via the token — only the owning agency's cars are reachable.
 *   POST   /api/agency/cars/{carId}/documents   (multipart: file, type=INSURANCE|REGISTRATION)
 *   GET    /api/agency/cars/{carId}/documents
 *   DELETE /api/agency/cars/{carId}/documents/{docId}
 */
@RestController
@RequestMapping("/api/agency/cars/{carId}/documents")
public class AgencyCarDocumentController {

    private final DocumentService documents;

    public AgencyCarDocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @PostMapping
    public ResponseEntity<DocumentResponse> upload(@AuthenticationPrincipal AuthPrincipal principal,
                                                   @PathVariable Long carId,
                                                   @RequestParam("type") DocumentType type,
                                                   @RequestParam("file") MultipartFile file) {
        DocumentResponse created = documents.uploadCarDocument(
                TenantContext.requireAgencyId(), principal.userId(), carId, type, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public List<DocumentResponse> list(@PathVariable Long carId) {
        return documents.listForCar(TenantContext.requireAgencyId(), carId);
    }

    @DeleteMapping("/{docId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthPrincipal principal,
                                       @PathVariable Long carId, @PathVariable Long docId) {
        // Authorization (the doc's car must belong to the caller's agency) is enforced in the service.
        documents.delete(principal, docId);
        return ResponseEntity.noContent().build();
    }
}
