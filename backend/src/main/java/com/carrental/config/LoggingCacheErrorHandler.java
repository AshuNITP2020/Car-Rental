package com.carrental.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.interceptor.CacheErrorHandler;

/**
 * Cache resilience (Task #44): if the cache backend (Redis) is down or erroring,
 * log and swallow instead of failing the request. A get error becomes a cache
 * <em>miss</em> — the method runs against the database — and put/evict/clear
 * errors are ignored, so a Redis outage degrades performance, never correctness.
 * The cache TTL bounds any staleness once Redis comes back.
 */
public class LoggingCacheErrorHandler implements CacheErrorHandler {

    private static final Logger log = LoggerFactory.getLogger(LoggingCacheErrorHandler.class);

    @Override
    public void handleCacheGetError(RuntimeException ex, Cache cache, Object key) {
        log.warn("Cache GET failed on '{}' (key={}) — falling through to source: {}",
                cache.getName(), key, ex.getMessage());
    }

    @Override
    public void handleCachePutError(RuntimeException ex, Cache cache, Object key, Object value) {
        log.warn("Cache PUT failed on '{}' (key={}): {}", cache.getName(), key, ex.getMessage());
    }

    @Override
    public void handleCacheEvictError(RuntimeException ex, Cache cache, Object key) {
        log.warn("Cache EVICT failed on '{}' (key={}): {}", cache.getName(), key, ex.getMessage());
    }

    @Override
    public void handleCacheClearError(RuntimeException ex, Cache cache) {
        log.warn("Cache CLEAR failed on '{}': {}", cache.getName(), ex.getMessage());
    }
}
