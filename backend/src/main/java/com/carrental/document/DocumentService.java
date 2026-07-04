package com.carrental.document;

import com.carrental.auth.AuthPrincipal;
import com.carrental.car.CarRepository;
import com.carrental.document.dto.DocumentResponse;
import com.carrental.user.KycStatus;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import com.carrental.storage.ObjectStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Private document handling (Task #37): KYC (user) and car insurance/registration
 * uploads, an authorized download path, and admin review. The whole point vs car
 * images (#36) is that <em>every</em> read goes through {@link #authorize}: only
 * the owner (the user, or the car's agency) or a platform admin may see a document,
 * and bytes are streamed from an authenticated endpoint — never a public/presigned
 * URL.
 */
@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final String PLATFORM_ADMIN = "PLATFORM_ADMIN";

    /** Documents are typically PDFs or photos of a document. */
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "application/pdf", ".pdf",
            "image/jpeg", ".jpg",
            "image/png", ".png");

    private final DocumentRepository documents;
    private final ObjectStorage storage;
    private final CarRepository cars;
    private final UserRepository users;

    public DocumentService(DocumentRepository documents, ObjectStorage storage,
                           CarRepository cars, UserRepository users) {
        this.documents = documents;
        this.storage = storage;
        this.cars = cars;
        this.users = users;
    }

    /** Bytes + content type of a downloaded document. */
    public record DownloadedDocument(byte[] content, String contentType) {
    }

    // ── Uploads ────────────────────────────────────────────────────────────────

    /** A user uploads one of their own KYC documents. */
    @Transactional
    public DocumentResponse uploadKyc(Long userId, DocumentType docType, MultipartFile file) {
        if (docType == null || !docType.isKyc()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not a KYC document type");
        }
        return store(DocumentOwnerType.USER, userId, docType, userId, file);
    }

    /** An agency member uploads a document for one of the agency's cars. */
    @Transactional
    public DocumentResponse uploadCarDocument(Long agencyId, Long uploaderUserId, Long carId,
                                              DocumentType docType, MultipartFile file) {
        if (docType == null || docType.ownerType() != DocumentOwnerType.CAR) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not a car document type");
        }
        requireOwnedCar(agencyId, carId);
        return store(DocumentOwnerType.CAR, carId, docType, uploaderUserId, file);
    }

    private DocumentResponse store(DocumentOwnerType ownerType, Long ownerId,
                                   DocumentType docType, Long uploaderUserId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Document file is required");
        }
        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String ext = ALLOWED_TYPES.get(contentType);
        if (ext == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported document type; allowed: PDF, JPEG, PNG");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded file");
        }

        // Private key namespace, distinct from the public car-image prefix (#36):
        //   kyc/<userId>/...   or   car-docs/<carId>/...
        String prefix = ownerType == DocumentOwnerType.USER ? "kyc/" : "car-docs/";
        String key = prefix + ownerId + "/" + UUID.randomUUID() + ext;
        storage.put(key, bytes, contentType);

        Document doc = new Document();
        doc.setOwnerType(ownerType);
        doc.setOwnerId(ownerId);
        doc.setDocType(docType);
        doc.setObjectKey(key);
        doc.setContentType(contentType);
        doc.setSizeBytes(bytes.length);
        doc.setStatus(DocumentStatus.PENDING);
        doc.setUploadedBy(uploaderUserId);
        documents.save(doc);
        return DocumentResponse.from(doc);
    }

    // ── Reads (owner-scoped) ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentResponse> listForUser(Long userId) {
        return documents.findByOwnerTypeAndOwnerIdOrderByIdAsc(DocumentOwnerType.USER, userId)
                .stream().map(DocumentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listForCar(Long agencyId, Long carId) {
        requireOwnedCar(agencyId, carId);
        return documents.findByOwnerTypeAndOwnerIdOrderByIdAsc(DocumentOwnerType.CAR, carId)
                .stream().map(DocumentResponse::from).toList();
    }

    /** Streams the bytes, but only after {@link #authorize} passes. */
    @Transactional(readOnly = true)
    public DownloadedDocument download(AuthPrincipal caller, Long documentId) {
        Document doc = load(documentId);
        authorize(caller, doc);
        byte[] bytes = storage.getBytes(doc.getObjectKey())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document content missing"));
        return new DownloadedDocument(bytes, doc.getContentType());
    }

    @Transactional
    public void delete(AuthPrincipal caller, Long documentId) {
        Document doc = load(documentId);
        authorize(caller, doc);
        documents.delete(doc);
        try {
            storage.delete(doc.getObjectKey());
        } catch (RuntimeException e) {
            log.warn("Removed document {} but its object {} may remain: {}",
                    documentId, doc.getObjectKey(), e.getMessage());
        }
    }

    // ── Admin review ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentResponse> listByStatus(DocumentStatus status) {
        List<Document> found = status == null ? documents.findAll()
                : documents.findByStatusOrderByIdAsc(status);
        return found.stream().map(DocumentResponse::from).toList();
    }

    /**
     * Approve/reject a document. For a KYC document this also moves the owning
     * user's {@code kycStatus} in lockstep, so verifying a user's ID marks them
     * verified (and rejecting marks them rejected).
     */
    @Transactional
    public DocumentResponse review(Long documentId, boolean approve, String note) {
        Document doc = load(documentId);
        doc.setStatus(approve ? DocumentStatus.VERIFIED : DocumentStatus.REJECTED);
        doc.setReviewNote(note);

        if (doc.getDocType().isKyc()) {
            User owner = users.findById(doc.getOwnerId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            owner.setKycStatus(approve ? KycStatus.VERIFIED : KycStatus.REJECTED);
        }
        return DocumentResponse.from(doc);
    }

    // ── Internals ────────────────────────────────────────────────────────────────

    private Document load(Long documentId) {
        return documents.findById(documentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    /**
     * The gate for all private access. A platform admin sees everything; otherwise
     * a USER doc is visible only to that user, and a CAR doc only to a member of the
     * agency that owns the car. Denials return 404 (not 403) so we don't reveal that
     * a document exists to someone not entitled to it.
     */
    private void authorize(AuthPrincipal caller, Document doc) {
        if (PLATFORM_ADMIN.equals(caller.role())) {
            return;
        }
        boolean allowed = switch (doc.getOwnerType()) {
            case USER -> caller.userId() != null && caller.userId().equals(doc.getOwnerId());
            case CAR -> caller.agencyId() != null
                    && cars.findByIdAndAgency_Id(doc.getOwnerId(), caller.agencyId()).isPresent();
        };
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found");
        }
    }

    private void requireOwnedCar(Long agencyId, Long carId) {
        cars.findByIdAndAgency_Id(carId, agencyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Car not found"));
    }
}
