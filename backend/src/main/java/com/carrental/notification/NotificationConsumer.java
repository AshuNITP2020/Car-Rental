package com.carrental.notification;

import com.carrental.events.DomainEvent;
import com.carrental.events.KafkaDomainEventForwarder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Reacts to domain events by notifying the customer (email + push) and
 * recording each message. Its own consumer group ("notifications") means it
 * receives every event independently of the analytics consumer (#29) — that's
 * the Kafka fan-out. Idempotent: a re-delivered event won't double-notify
 * (unique index on booking+type+channel).
 */
@Component
public class NotificationConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificationConsumer.class);

    private final ObjectMapper objectMapper;
    private final NotificationSender sender;
    private final NotificationRepository notifications;

    public NotificationConsumer(ObjectMapper objectMapper, NotificationSender sender,
                                NotificationRepository notifications) {
        this.objectMapper = objectMapper;
        this.sender = sender;
        this.notifications = notifications;
    }

    @KafkaListener(topics = KafkaDomainEventForwarder.TOPIC, groupId = "notifications")
    @Transactional
    public void onEvent(String message) {
        DomainEvent event = objectMapper.readValue(message, DomainEvent.class);
        String text = messageFor(event.type());
        if (text == null) {
            return;
        }

        notifyOnce(event, NotificationSender.Channel.EMAIL, text);
        notifyOnce(event, NotificationSender.Channel.PUSH, text);
    }

    private void notifyOnce(DomainEvent event, NotificationSender.Channel channel, String text) {
        if (event.bookingId() != null
                && notifications.existsByBookingIdAndTypeAndChannel(
                        event.bookingId(), event.type(), channel.name())) {
            return;
        }
        sender.send(channel, event.userId(), subjectFor(event.type()), text);

        Notification n = new Notification();
        n.setUserId(event.userId());
        n.setBookingId(event.bookingId());
        n.setChannel(channel.name());
        n.setType(event.type());
        n.setPayload(text);
        n.setStatus("SENT");
        notifications.save(n);
    }

    private String subjectFor(String type) {
        return switch (type) {
            case DomainEvent.BOOKING_CONFIRMED -> "Your booking is confirmed";
            case DomainEvent.BOOKING_CANCELLED -> "Your booking was cancelled";
            case DomainEvent.BOOKING_COMPLETED -> "Your trip is complete";
            case DomainEvent.BOOKING_REMINDER -> "Reminder: your pickup is coming up";
            default -> "Booking update";
        };
    }

    /** Returns the message body, or null for events we don't notify on. */
    private String messageFor(String type) {
        return switch (type) {
            case DomainEvent.BOOKING_CONFIRMED -> "Your car booking is confirmed. Have a great trip!";
            case DomainEvent.BOOKING_CANCELLED -> "Your booking has been cancelled. Any refund is on its way.";
            case DomainEvent.BOOKING_COMPLETED -> "Thanks for renting with us. Your trip is now complete.";
            case DomainEvent.BOOKING_REMINDER -> "Your car pickup is coming up soon. See you then!";
            default -> null;   // PAYMENT_CAPTURED etc. -> no customer notification
        };
    }
}
