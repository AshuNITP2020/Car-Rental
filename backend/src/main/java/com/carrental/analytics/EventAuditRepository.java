package com.carrental.analytics;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EventAuditRepository extends JpaRepository<EventAudit, Long> {

    boolean existsByEventId(String eventId);
}
