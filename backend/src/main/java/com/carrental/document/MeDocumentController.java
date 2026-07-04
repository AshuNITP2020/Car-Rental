package com.carrental.document;

import com.carrental.auth.AuthPrincipal;
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
 * A user manages their own KYC documents. Everything is scoped to the
 * caller's own id from the token, so a user can only ever see/change their own.
 *   POST   /api/me/kyc-documents   (multipart: file, type=KYC_IDENTITY|KYC_ADDRESS)
 *   GET    /api/me/kyc-documents
 *   DELETE /api/me/kyc-documents/{id}
 */
@RestController
@RequestMapping("/api/me/kyc-documents")
public class MeDocumentController {

    private final DocumentService documents;

    public MeDocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @PostMapping
    public ResponseEntity<DocumentResponse> upload(@AuthenticationPrincipal AuthPrincipal principal,
                                                   @RequestParam("type") DocumentType type,
                                                   @RequestParam("file") MultipartFile file) {
        DocumentResponse created = documents.uploadKyc(principal.userId(), type, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public List<DocumentResponse> list(@AuthenticationPrincipal AuthPrincipal principal) {
        return documents.listForUser(principal.userId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthPrincipal principal,
                                       @PathVariable Long id) {
        documents.delete(principal, id);
        return ResponseEntity.noContent().build();
    }
}
