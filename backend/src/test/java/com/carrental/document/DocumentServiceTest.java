package com.carrental.document;

import com.carrental.auth.AuthPrincipal;
import com.carrental.agency.Agency;
import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyStatus;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.document.dto.DocumentResponse;
import com.carrental.storage.ObjectStorage;
import com.carrental.user.KycStatus;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import com.carrental.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Task #37: private document upload + the authorization gate, against the real
 * (dev) Postgres. {@code @Transactional} rolls DB rows back; storage writes go
 * under {@code build/}. The focus is that reads are gated — only the owner, the
 * car's agency, or a platform admin may see a document.
 */
@SpringBootTest
@Transactional
@TestPropertySource(properties = "app.storage.local.dir=build/test-uploads")
class DocumentServiceTest {

    @Autowired DocumentService documents;
    @Autowired DocumentRepository documentRepo;
    @Autowired ObjectStorage storage;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;

    private Long userId, otherUserId, adminId, agencyId, otherAgencyId, ownerId, carId;

    @BeforeEach
    void seed() {
        userId = newUser("kyc", UserRole.CUSTOMER);
        otherUserId = newUser("other", UserRole.CUSTOMER);
        adminId = newUser("admin", UserRole.PLATFORM_ADMIN);
        ownerId = newUser("owner", UserRole.CUSTOMER);

        Agency agency = new Agency();
        agency.setName("Doc Agency");
        agency.setOwner(users.findById(ownerId).orElseThrow());
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);
        agencyId = agency.getId();

        Agency other = new Agency();
        other.setName("Other Agency");
        other.setOwner(users.findById(ownerId).orElseThrow());
        other.setStatus(AgencyStatus.ACTIVE);
        agencies.save(other);
        otherAgencyId = other.getId();

        Car car = new Car();
        car.setAgency(agency);
        car.setMake("Tata");
        car.setModel("Nexon");
        car.setCategory("SUV");
        car.setRegNo("DOC-" + UUID.randomUUID().toString().substring(0, 8));
        car.setPricePerDay(new BigDecimal("2000"));
        car.setStatus(CarStatus.AVAILABLE);
        cars.save(car);
        carId = car.getId();
    }

    private Long newUser(String tag, UserRole role) {
        User u = new User();
        u.setName(tag);
        u.setEmail("doc-" + tag + "-" + UUID.randomUUID() + "@test.local");
        u.setPasswordHash("x");
        u.setRole(role);
        users.save(u);
        return u.getId();
    }

    private MultipartFile pdf(byte[] bytes) {
        return new MockMultipartFile("file", "doc.pdf", "application/pdf", bytes);
    }

    private AuthPrincipal user(Long id) {
        return new AuthPrincipal(id, "CUSTOMER", null, null);
    }

    private AuthPrincipal agencyMember(Long id, Long agency) {
        return new AuthPrincipal(id, "CUSTOMER", agency, "ADMIN");
    }

    private AuthPrincipal admin(Long id) {
        return new AuthPrincipal(id, "PLATFORM_ADMIN", null, null);
    }

    @Test
    void kyc_uploadDownloadByOwnerAndAdmin_thenReviewSetsKycStatus() {
        byte[] bytes = "kyc-pdf".getBytes();
        DocumentResponse doc = documents.uploadKyc(userId, DocumentType.KYC_IDENTITY, pdf(bytes));

        assertEquals("USER", doc.ownerType());
        assertEquals(userId, doc.ownerId());
        assertEquals("PENDING", doc.status());

        // Owner and admin can read the bytes.
        assertArrayEquals(bytes, documents.download(user(userId), doc.id()).content());
        assertArrayEquals(bytes, documents.download(admin(adminId), doc.id()).content());

        // Admin verifies -> document VERIFIED and the user's kycStatus follows.
        DocumentResponse reviewed = documents.review(doc.id(), true, "looks good");
        assertEquals("VERIFIED", reviewed.status());
        assertEquals(KycStatus.VERIFIED, users.findById(userId).orElseThrow().getKycStatus());
    }

    @Test
    void kyc_downloadByAnotherUser_is404() {
        DocumentResponse doc = documents.uploadKyc(userId, DocumentType.KYC_IDENTITY, pdf("x".getBytes()));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> documents.download(user(otherUserId), doc.id()));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void kyc_upload_rejectsCarDocumentType() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> documents.uploadKyc(userId, DocumentType.INSURANCE, pdf("x".getBytes())));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void carDocument_isReadableByItsAgency_butNotAnother() {
        byte[] bytes = "insurance-pdf".getBytes();
        DocumentResponse doc = documents.uploadCarDocument(
                agencyId, ownerId, carId, DocumentType.INSURANCE, pdf(bytes));
        assertEquals("CAR", doc.ownerType());
        assertEquals(carId, doc.ownerId());

        // A member of the owning agency can read it.
        assertArrayEquals(bytes, documents.download(agencyMember(ownerId, agencyId), doc.id()).content());

        // A member of a different agency cannot (404, not 403 — don't reveal existence).
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> documents.download(agencyMember(ownerId, otherAgencyId), doc.id()));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void delete_removesRowAndObject() {
        DocumentResponse doc = documents.uploadKyc(userId, DocumentType.KYC_ADDRESS, pdf("x".getBytes()));
        String key = documentRepo.findById(doc.id()).orElseThrow().getObjectKey();
        assertTrue(storage.getBytes(key).isPresent());

        documents.delete(user(userId), doc.id());

        assertTrue(storage.getBytes(key).isEmpty(), "object should be gone");
        assertThrows(ResponseStatusException.class, () -> documents.download(user(userId), doc.id()));
    }
}
