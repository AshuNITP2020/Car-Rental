package com.carrental.admin;

import com.carrental.auth.dto.UserResponse;
import com.carrental.user.UserRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Platform-admin-only endpoints. Guarded two ways (defense in depth):
 *  - URL rule in SecurityConfig: /api/admin/** requires ROLE_PLATFORM_ADMIN
 *  - @PreAuthorize on the method (method-level guard)
 * A CUSTOMER token here yields 403.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository users;

    public AdminController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public List<UserResponse> listUsers() {
        return users.findAll().stream().map(UserResponse::from).toList();
    }
}
