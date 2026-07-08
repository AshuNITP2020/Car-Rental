package com.carrental.config;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * Read/write splitting across a primary (writer) and a read replica (Task #47).
 *
 * <p><b>Inert by default.</b> This whole configuration only activates when
 * {@code app.datasource.replica.url} is set (e.g. env {@code
 * APP_DATASOURCE_REPLICA_URL}). With no replica configured — the default, and in
 * every test — Spring Boot's normal single-DataSource autoconfiguration runs and
 * behaviour is unchanged.
 *
 * <p>When active it defines the app's {@code @Primary} {@link DataSource} as a
 * {@link RoutingDataSource}: {@code @Transactional(readOnly = true)} queries go to
 * the replica pool, while writes, DDL, Flyway migrations and anything outside a
 * read-only transaction go to the primary. Defining a {@code @Primary} DataSource
 * makes Boot back off its own, so JPA, Flyway and the health indicator all use the
 * router.
 *
 * <p>Built from raw {@link Environment} properties + Hikari directly (not Boot's
 * {@code DataSourceProperties}) so it's independent of Boot's autoconfig package
 * layout. The primary pool still reads {@code spring.datasource.*} (including the
 * test pool-size cap), so nothing about the existing config changes.
 */
@Configuration
@ConditionalOnProperty(name = "app.datasource.replica.url")
public class ReplicaDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(ReplicaDataSourceConfig.class);

    @Bean
    @Primary
    public DataSource dataSource(Environment env) {
        String primaryUrl = env.getProperty("spring.datasource.url");
        String primaryUser = env.getProperty("spring.datasource.username");
        String primaryPass = env.getProperty("spring.datasource.password");
        int primaryPool = env.getProperty("spring.datasource.hikari.maximum-pool-size", Integer.class, 10);

        String replicaUrl = env.getProperty("app.datasource.replica.url");

        String replicaUser = env.getProperty("app.datasource.replica.username", primaryUser);
        String replicaPass = env.getProperty("app.datasource.replica.password", primaryPass);
        int replicaPool = env.getProperty("app.datasource.replica.hikari.maximum-pool-size",
                Integer.class, primaryPool);

        HikariDataSource primary = buildPool("primary", primaryUrl, primaryUser, primaryPass, primaryPool, false);
        HikariDataSource replica = buildPool("replica", replicaUrl, replicaUser, replicaPass, replicaPool, true);

        RoutingDataSource routing = new RoutingDataSource();
        Map<Object, Object> targets = new HashMap<>();
        targets.put(DataSourceRole.PRIMARY, primary);
        targets.put(DataSourceRole.REPLICA, replica);
        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(primary);
        routing.afterPropertiesSet();

        log.info("Read replica ENABLED — read-only tx -> replica [{}], writes/DDL -> primary [{}]",
                replicaUrl, primaryUrl);
        return new LazyConnectionDataSourceProxy(routing);
    }

    private static HikariDataSource buildPool(String name, String url, String user, String pass,
                                              int maxPoolSize, boolean readOnly) {
        HikariDataSource ds = new HikariDataSource();
        ds.setPoolName("carrental-" + name);
        ds.setJdbcUrl(url);
        ds.setUsername(user);
        ds.setPassword(pass);
        ds.setMaximumPoolSize(maxPoolSize);
        ds.setReadOnly(readOnly);
        return ds;
    }
}
