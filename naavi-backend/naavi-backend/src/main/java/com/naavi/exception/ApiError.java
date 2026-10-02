package com.naavi.exception;

import java.time.Instant;
import java.util.Map;

public record ApiError(int status, String error, String message, Map<String, String> fieldErrors, Instant timestamp) {
    public static ApiError of(int status, String error, String message) {
        return new ApiError(status, error, message, null, Instant.now());
    }
}
