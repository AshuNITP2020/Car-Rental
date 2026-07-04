package com.carrental.car;

import com.carrental.agency.Agency;
import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyStatus;
import com.carrental.car.dto.CarImageResponse;
import com.carrental.storage.ObjectStorage;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Task #36: car image upload/list/delete through the local storage provider,
 * against the real (dev) Postgres. {@code @Transactional} rolls the DB rows back;
 * the storage dir is redirected under {@code build/} so uploaded files don't
 * pollute the repo (and are cleaned by {@code gradle clean}).
 */
@SpringBootTest
@Transactional
@TestPropertySource(properties = "app.storage.local.dir=build/test-uploads")
class CarImageServiceTest {

    @Autowired CarImageService imageService;
    @Autowired ObjectStorage storage;
    @Autowired UserRepository users;
    @Autowired AgencyRepository agencies;
    @Autowired CarRepository cars;

    private Long agencyId;
    private Long carId;
    private Long otherAgencyId;

    @BeforeEach
    void seed() {
        User owner = new User();
        owner.setName("Owner");
        owner.setEmail("img-owner-" + UUID.randomUUID() + "@test.local");
        owner.setPasswordHash("x");
        users.save(owner);

        Agency agency = new Agency();
        agency.setName("Image Agency");
        agency.setOwner(owner);
        agency.setCity("ImgCity");
        agency.setStatus(AgencyStatus.ACTIVE);
        agencies.save(agency);
        agencyId = agency.getId();

        Agency other = new Agency();
        other.setName("Other Agency");
        other.setOwner(owner);
        other.setStatus(AgencyStatus.ACTIVE);
        agencies.save(other);
        otherAgencyId = other.getId();

        Car car = new Car();
        car.setAgency(agency);
        car.setMake("Tata");
        car.setModel("Nexon");
        car.setCategory("SUV");
        car.setRegNo("IMG-" + UUID.randomUUID().toString().substring(0, 8));
        car.setPricePerDay(new BigDecimal("2000"));
        car.setStatus(CarStatus.AVAILABLE);
        cars.save(car);
        carId = car.getId();
    }

    private MockMultipartFile jpeg(byte[] bytes) {
        return new MockMultipartFile("file", "car.jpg", "image/jpeg", bytes);
    }

    @Test
    void upload_thenList_thenDelete() {
        byte[] bytes = "fake-jpeg".getBytes();

        CarImageResponse created = imageService.upload(agencyId, carId, jpeg(bytes));
        assertEquals(carId, created.carId());
        assertEquals("image/jpeg", created.contentType());
        assertEquals(bytes.length, created.sizeBytes());
        assertTrue(created.url().startsWith("/api/media/cars/" + carId + "/"), created.url());

        // Bytes actually landed in storage.
        String key = created.url().substring("/api/media/".length());
        assertArrayEquals(bytes, storage.getBytes(key).orElseThrow());

        // Both the agency and customer reads see it.
        assertEquals(1, imageService.listForAgency(agencyId, carId).size());
        assertEquals(1, imageService.listForCustomer(carId).size());

        imageService.delete(agencyId, carId, created.id());
        assertTrue(imageService.listForAgency(agencyId, carId).isEmpty());
        assertTrue(storage.getBytes(key).isEmpty(), "object should be gone after delete");
    }

    @Test
    void rejectsNonImageType() {
        MockMultipartFile pdf = new MockMultipartFile("file", "doc.pdf", "application/pdf", "x".getBytes());
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> imageService.upload(agencyId, carId, pdf));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void cannotTouchAnotherAgencysCar() {
        // The car belongs to `agencyId`; acting as `otherAgencyId` must 404.
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> imageService.upload(otherAgencyId, carId, jpeg("x".getBytes())));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }
}
