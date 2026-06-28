package com.carrental.events;

import com.carrental.booking.Booking;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * Builds domain events from a booking and publishes them as in-process Spring
 * events. They are forwarded to Kafka only after the surrounding DB transaction
 * commits (see KafkaDomainEventForwarder) — so an event never escapes for a
 * change that rolled back.
 */
@Service
public class DomainEventPublisher {

    private final ApplicationEventPublisher publisher;

    public DomainEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(String type, Booking booking) {
        publisher.publishEvent(new DomainEvent(
                type,
                booking.getId(),
                booking.getUser().getId(),
                booking.getAgency().getId(),
                booking.getCar().getId(),
                booking.getAmount(),
                OffsetDateTime.now().toString()));
    }
}
