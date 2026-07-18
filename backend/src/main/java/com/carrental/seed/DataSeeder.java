package com.carrental.seed;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Runs the bulk seed at startup, but ONLY when app.seed.enabled=true.
 * Run it on demand, e.g.:
 *   ./gradlew bootRun --args='--app.seed.enabled=true'
 * Counts are overridable: --app.seed.agencies=200 etc.
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DataSeeder implements ApplicationRunner {

    private final SeedService seedService;

    @Value("${app.seed.customers:1000}")
    private int customers;
    @Value("${app.seed.agencies:200}")
    private int agencies;
    @Value("${app.seed.cars:5000}")
    private int cars;

    public DataSeeder(SeedService seedService) {
        this.seedService = seedService;
    }

    @Override
    public void run(ApplicationArguments args) {
        seedService.seed(customers, agencies, cars);
        // Wide-area intercity operators; idempotent, runs even when the bulk
        // seed is skipped (so existing DBs pick them up).
        seedService.seedCorridors();
    }
}
