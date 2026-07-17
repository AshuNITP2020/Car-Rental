package com.carrental.search;

import java.time.OffsetDateTime;

/**
 * Normalized, validated inputs for a car search. The trip-first flow needs no
 * more than this: available cars — optionally one agency's fleet (its public
 * profile page), optionally free for a window. {@code from}/{@code to} are
 * either both set (availability filter) or both null. Results are always
 * ordered cheapest first (deterministic tie-break on id).
 */
public record CarSearchCriteria(
        /** Restrict to one agency's fleet, or null for all. */
        Long agencyId,
        OffsetDateTime from,
        OffsetDateTime to,
        int page,
        int size
) {
    /**
     * A stable string key over every field that affects the result set — used as
     * the Redis cache key. Two criteria produce the same key iff they
     * would return the same page, so distinct filters never collide.
     */
    public String cacheKey() {
        return String.join("|",
                String.valueOf(agencyId), String.valueOf(from), String.valueOf(to),
                String.valueOf(page), String.valueOf(size));
    }
}
