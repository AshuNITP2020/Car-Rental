package com.carrental.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Time-based booking maintenance — the work Kafka can't do (it reacts to
 * events; this fires on the clock). Each method delegates to a transactional
 * BookingService method. Intervals are config-driven (app.scheduler.*).
 */
@Component
public class BookingScheduler {

    private static final Logger log = LoggerFactory.getLogger(BookingScheduler.class);

    private final BookingService bookingService;

    @Value("${app.scheduler.reminder-window-hours:24}")
    private long reminderWindowHours;

    public BookingScheduler(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    /** #30: free abandoned holds. */
    @Scheduled(fixedDelayString = "${app.scheduler.hold-expiry-ms:60000}")
    public void expireStaleHolds() {
        bookingService.expireStaleHolds();
    }

    /** #31: close out rentals whose end time has passed. */
    @Scheduled(fixedDelayString = "${app.scheduler.auto-complete-ms:300000}")
    public void autoCompleteOverdue() {
        bookingService.autoCompleteOverdue();
    }

    /** #31: remind customers whose pickup is near. */
    @Scheduled(fixedDelayString = "${app.scheduler.reminder-ms:300000}")
    public void sendPickupReminders() {
        bookingService.remindUpcomingPickups(reminderWindowHours);
    }

    /** #31: nightly summary report. */
    @Scheduled(cron = "${app.scheduler.report-cron:0 0 1 * * *}")
    public void nightlyReport() {
        log.info(bookingService.statusReport());
    }
}
