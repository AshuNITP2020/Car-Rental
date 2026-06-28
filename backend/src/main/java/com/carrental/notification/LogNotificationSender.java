package com.carrental.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Default notification sender — logs instead of really sending, so the app runs
 * with zero setup. Active when app.notifications.provider=log (the default).
 * Real FCM/SMTP senders gated on other values can be added later.
 */
@Component
@ConditionalOnProperty(name = "app.notifications.provider", havingValue = "log", matchIfMissing = true)
public class LogNotificationSender implements NotificationSender {

    private static final Logger log = LoggerFactory.getLogger(LogNotificationSender.class);

    @Override
    public void send(Channel channel, Long userId, String subject, String body) {
        log.info("[{}] -> user {}: {} | {}", channel, userId, subject, body);
    }
}
