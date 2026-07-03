package com.carrental.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.cache.RedisCacheWriter;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;

import java.time.Duration;

/**
 * Redis-backed caching (Task #34). {@code @EnableCaching} turns on the Spring
 * Cache aspect; this bean replaces Boot's auto-configured {@code RedisCacheManager}
 * so we can control two things that matter for correct invalidation:
 *
 * <ol>
 *   <li><b>Synchronous writes.</b> Boot's default writer is <i>asynchronous</i>
 *       with Lettuce (which is also a {@code ReactiveRedisConnectionFactory}), so
 *       {@code @CacheEvict} / {@code clear()} return before Redis has applied the
 *       delete — a write could be immediately followed by a stale cache hit.
 *       {@code immediateWrites(true)} forces blocking writes, giving
 *       read-your-writes invalidation (and a deterministic test).</li>
 *   <li><b>Bounded TTL + JSON values.</b> A short TTL means even a missed eviction
 *       self-heals; JSON values are human-readable in {@code redis-cli} and need no
 *       {@code Serializable}. Keys keep {@code defaultCacheConfig()}'s
 *       {@code StringRedisSerializer}, so our string cache keys store verbatim.</li>
 * </ol>
 *
 * <p>Only the customer car-search reads are cached, and only the non-availability
 * ones — see {@code CarSearchService}. Invalidation is coarse (evict the whole
 * region on any car/agency write), the simplest correct strategy; refine to
 * per-city keys later if writes get hot.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    /** Hot customer car-search reads. Evicted on any car/agency write. */
    public static final String CAR_SEARCH_CACHE = "carSearch";

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory,
            @Value("${app.cache.search-ttl-seconds:60}") long ttlSeconds) {

        RedisCacheWriter writer = RedisCacheWriter.create(connectionFactory,
                config -> config.immediateWrites(true));

        RedisCacheConfiguration cacheConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(ttlSeconds))
                .disableCachingNullValues()
                .serializeValuesWith(SerializationPair.fromSerializer(
                        // Embeds an @class hint so the cached records round-trip back
                        // to their concrete types. Safe here: only this app writes the
                        // cache, so the deserialized types are always our own.
                        GenericJacksonJsonRedisSerializer.builder()
                                .enableUnsafeDefaultTyping()
                                .build()));

        return RedisCacheManager.builder(writer).cacheDefaults(cacheConfig).build();
    }
}
