package com.carrental.config;

import java.util.List;

/**
 * The single error shape for the whole API. Every handled failure —
 * validation, bad params, a thrown {@code ResponseStatusException}, a 429 from the
 * rate limiter — serializes to this, so clients get one predictable contract and
 * we never leak stack traces or internal types. {@code fieldErrors} is empty
 * unless the failure was per-field bean validation.
 */
public record ApiError(
        int status,
        String error,
        String message,
        String path,
        List<FieldError> fieldErrors
) {
    public record FieldError(String field, String message) {
    }
}
