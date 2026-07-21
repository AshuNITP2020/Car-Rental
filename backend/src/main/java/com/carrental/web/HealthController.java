package com.carrental.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

/**
 * Walking-skeleton health endpoint: proves the full vertical slice
 * React -> Spring Boot -> Postgres works. The browser (via Vite's /api proxy)
 * calls this; we round-trip to the database and report what we found.
 */
@Tag(name = "Health", description = "Liveness + database connectivity")
@RestController
@RequestMapping("/api")
public class HealthController {

    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> health() {
        try {
            // Round-trip to the DB; returning its clock proves a live connection.
            OffsetDateTime dbTime = jdbc.queryForObject("SELECT now()", OffsetDateTime.class);
            return ResponseEntity.ok(
                    new HealthResponse("ok", "car-rental-backend", "up", String.valueOf(dbTime)));
        } catch (DataAccessException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new HealthResponse("degraded", "car-rental-backend", "down", null));
        }
    }

    /** Response shape returned as JSON. */
    public record HealthResponse(String status, String service, String database, String dbTime) {
    }
}
