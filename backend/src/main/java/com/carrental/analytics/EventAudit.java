package com.carrental.analytics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Append-only record of a domain event, written by the analytics consumer. */
@Entity
@Table(name = "event_audit")
@Getter
@Setter
@NoArgsConstructor
public class EventAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", length = 80)
    private String eventId;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "agency_id")
    private Long agencyId;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "occurred_at")
    private OffsetDateTime occurredAt;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private OffsetDateTime receivedAt;
}
