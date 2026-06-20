package com.carrental.auth.dto;

import com.carrental.user.User;

/** Public view of a user — never exposes the password hash. */
public record UserResponse(
        Long id,
        String name,
        String email,
        String phone,
        String kycStatus
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getKycStatus().name());
    }
}
