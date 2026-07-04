package com.carrental.document;

import com.carrental.auth.AuthPrincipal;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * The private download endpoint (Task #37). This is the deliberate contrast with
 * car images: it is <b>authenticated</b> (not in the security permit-list) and
 * re-checks authorization per request inside {@link DocumentService#download}, then
 * streams the bytes with {@code no-store} so they're never cached or shared. There
 * is no public or presigned URL for a private document.
 *   GET /api/documents/{id}/content
 */
@RestController
public class DocumentContentController {

    private final DocumentService documents;

    public DocumentContentController(DocumentService documents) {
        this.documents = documents;
    }

    @GetMapping("/api/documents/{id}/content")
    public ResponseEntity<byte[]> download(@AuthenticationPrincipal AuthPrincipal principal,
                                           @PathVariable Long id) {
        DocumentService.DownloadedDocument doc = documents.download(principal, id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(doc.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .cacheControl(CacheControl.noStore())
                .body(doc.content());
    }
}
