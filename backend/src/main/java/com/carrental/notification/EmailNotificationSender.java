package com.carrental.notification;

import com.carrental.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Real notification sender — delivers EMAIL over SMTP (Spring Mail). Active when
 * app.notifications.provider=email. PUSH is logged (FCM not wired). Resolves the
 * recipient address from the user id the consumer passes.
 *
 * Activate with SMTP creds, e.g. Mailtrap:
 *   --app.notifications.provider=email --spring.mail.host=sandbox.smtp.mailtrap.io \
 *   --spring.mail.port=2525 --spring.mail.username=... --spring.mail.password=...
 */
@Component
@ConditionalOnProperty(name = "app.notifications.provider", havingValue = "email")
public class EmailNotificationSender implements NotificationSender {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationSender.class);

    private final JavaMailSender mailSender;
    private final UserRepository users;

    @Value("${app.notifications.email.from:no-reply@car-rental.local}")
    private String from;

    public EmailNotificationSender(JavaMailSender mailSender, UserRepository users) {
        this.mailSender = mailSender;
        this.users = users;
    }

    @Override
    public void send(Channel channel, Long userId, String subject, String body) {
        if (channel != Channel.EMAIL) {
            log.info("[{}] (not wired to a provider) -> user {}: {}", channel, userId, subject);
            return;
        }
        String to = users.findById(userId).map(u -> u.getEmail()).orElse(null);
        if (to == null) {
            log.warn("No email address for user {}; skipping email", userId);
            return;
        }
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(to);
        mail.setSubject(subject);
        mail.setText(body);
        mailSender.send(mail);
        log.info("Email sent to {} ({})", to, subject);
    }
}
