package com.carrental.search;

import java.time.OffsetDateTime;

/**
 * Normalized, validated inputs for a car search. The trip-first flow needs:
 * available cars — optionally one agency's fleet (its public profile page),
 * optionally free for a window, optionally of a car TYPE ({@code category})
 * with at least {@code minSeats} seats (how customers actually filter — not by
 * make/model). {@code from}/{@code to} are either both set or both null.
 * Results are always ordered cheapest first (deterministic tie-break on id).
 */
public record CarSearchCriteria(
        /** Restrict to one agency's fleet, or null for all. */
        Long agencyId,
        /** Car type, e.g. "SUV" (case-insensitive), or null for any. */
        String category,
        /** Minimum passenger seats, or null for any. */
        Integer minSeats,
        OffsetDateTime from,
        OffsetDateTime to,
        int page,
        int size
) {
    /** Normalize the type up front — the JPQL compares against upper(category). */
    public CarSearchCriteria {
        category = category != null ? category.toUpperCase() : null;
    }

    /**
     * A stable string key over every field that affects the result set — used as
     * the Redis cache key. Two criteria produce the same key iff they
     * would return the same page, so distinct filters never collide.
     */
    public String cacheKey() {
        return String.join("|",
                String.valueOf(agencyId), String.valueOf(category), String.valueOf(minSeats),
                String.valueOf(from), String.valueOf(to),
                String.valueOf(page), String.valueOf(size));
    }
}
