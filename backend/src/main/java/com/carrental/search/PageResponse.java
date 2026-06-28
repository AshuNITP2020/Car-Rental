package com.carrental.search;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * A page of results plus the metadata a client needs to page through them.
 * Decouples the API from Spring Data's {@code Page} (which serializes a large,
 * unstable shape). Generic so it can wrap any result type. (Task #32)
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext());
    }
}
