package com.carrental.notification;

/**
 * Sends a message over a channel (email / push). The default impl logs; real
 * SMTP (email) and FCM (push) senders can be added behind config later, with
 * no change to the consumer — same swap pattern as the payment gateway.
 */
public interface NotificationSender {

    enum Channel { EMAIL, PUSH }

    void send(Channel channel, Long userId, String subject, String body);
}
