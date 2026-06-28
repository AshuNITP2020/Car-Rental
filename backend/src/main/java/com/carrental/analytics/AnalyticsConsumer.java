package com.carrental.analytics;

import com.carrental.events.DomainEvent;
import com.carrental.events.KafkaDomainEventForwarder;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;

/**
 * Second, independent consumer of the same topic — its own consumer group
 * ("analytics") means it receives EVERY event regardless of the notification
 * consumer. This is the Kafka fan-out: one publish, many independent reactors.
 * Records every event in an append-only audit log; idempotent via event_id.
 */
@Component
public class AnalyticsConsumer {

    private final ObjectMapper objectMapper;
    private final EventAuditRepository audits;

    public AnalyticsConsumer(ObjectMapper objectMapper, EventAuditRepository audits) {
        this.objectMapper = objectMapper;
        this.audits = audits;
    }

    @KafkaListener(topics = KafkaDomainEventForwarder.TOPIC, groupId = "analytics")
    @Transactional
    public void onEvent(String message) {
        DomainEvent event = objectMapper.readValue(message, DomainEvent.class);
        String eventId = event.type() + ":" + event.bookingId() + ":" + event.occurredAt();
        if (audits.existsByEventId(eventId)) {
            return;   // already recorded — idempotent skip
        }
        EventAudit audit = new EventAudit();
        audit.setEventId(eventId);
        audit.setType(event.type());
        audit.setBookingId(event.bookingId());
        audit.setUserId(event.userId());
        audit.setAgencyId(event.agencyId());
        audit.setAmount(event.amount());
        if (event.occurredAt() != null) {
            audit.setOccurredAt(OffsetDateTime.parse(event.occurredAt()));
        }
        audits.save(audit);
    }
}
