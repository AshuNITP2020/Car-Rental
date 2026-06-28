package com.carrental.notification;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    boolean existsByBookingIdAndTypeAndChannel(Long bookingId, String type, String channel);
}
