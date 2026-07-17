package com.carrental.events;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.ObjectMapper;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Forwards in-process DomainEvents to Kafka, but only AFTER_COMMIT — so an
 * event is published exactly when the DB change that produced it is durable.
 * (Residual gap: if the Kafka send itself fails post-commit the event is lost;
 * the production-grade fix is a transactional outbox table drained to Kafka.)
 *
 * One topic, keyed by bookingId so a booking's events stay ordered; consumers
 * (#28 notifications, #29 analytics) subscribe in separate consumer groups.
 */
@Component
public class KafkaDomainEventForwarder {

    public static final String TOPIC = "car-rental.events";
    private static final Logger log = LoggerFactory.getLogger(KafkaDomainEventForwarder.class);

    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper objectMapper;

    public KafkaDomainEventForwarder(KafkaTemplate<String, String> kafka, ObjectMapper objectMapper) {
        this.kafka = kafka;
        this.objectMapper = objectMapper;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void forward(DomainEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            kafka.send(TOPIC, String.valueOf(event.bookingId()), json);
            log.debug("Published {} for booking {}", event.type(), event.bookingId());
        } catch (RuntimeException e) {
            log.error("Failed to publish domain event {}: {}", event, e.getMessage());
        }
    }
}
