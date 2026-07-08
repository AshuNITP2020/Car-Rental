package com.carrental.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Unit test for the read/write routing key (Task #47) — no database needed.
 * Verifies read-only transactions resolve to the replica and everything else to
 * the primary.
 */
class RoutingDataSourceTest {

    private final RoutingDataSource router = new RoutingDataSource();

    @AfterEach
    void reset() {
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
    }

    @Test
    void noActiveReadOnlyTransaction_routesToPrimary() {
        assertEquals(DataSourceRole.PRIMARY, router.determineCurrentLookupKey());
    }

    @Test
    void readOnlyTransaction_routesToReplica() {
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);
        assertEquals(DataSourceRole.REPLICA, router.determineCurrentLookupKey());
    }

    @Test
    void writeTransaction_routesToPrimary() {
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
        assertEquals(DataSourceRole.PRIMARY, router.determineCurrentLookupKey());
    }
}
