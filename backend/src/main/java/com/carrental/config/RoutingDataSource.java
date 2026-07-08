package com.carrental.config;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Picks the target database per connection based on the current transaction's
 * read-only flag (Task #47): {@code @Transactional(readOnly = true)} → the read
 * replica, everything else (writes, DDL, Flyway, no active transaction) → the
 * primary. Spring sets the read-only flag when the transaction begins, and with
 * Hibernate's delayed connection acquisition (and the {@code
 * LazyConnectionDataSourceProxy} wrapping this router) the key is resolved when the
 * first statement runs — by which point the flag is set.
 */
public class RoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
                ? DataSourceRole.REPLICA
                : DataSourceRole.PRIMARY;
    }
}
