package com.carrental.auth;

import com.carrental.auth.dto.AuthResponse;
import com.carrental.auth.dto.LoginRequest;
import com.carrental.auth.dto.RefreshRequest;
import com.carrental.auth.dto.RegisterRequest;
import com.carrental.auth.dto.UserResponse;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        User user = new User();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPhone(req.phone());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        users.save(user);
        return tokensFor(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase();
        // Same generic error whether the email is unknown or the password is
        // wrong, so we don't reveal which emails exist.
        User user = users.findByEmail(email)
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return tokensFor(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(RefreshRequest req) {
        Claims claims;
        try {
            claims = jwtService.parse(req.refreshToken());
        } catch (JwtException | IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
        if (!JwtService.TYPE_REFRESH.equals(jwtService.tokenType(claims))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not a refresh token");
        }
        User user = users.findById(jwtService.userId(claims))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User no longer exists"));
        // Rotate both tokens on refresh.
        return tokensFor(user);
    }

    private AuthResponse tokensFor(User user) {
        return new AuthResponse(
                jwtService.generateAccessToken(user),
                jwtService.generateRefreshToken(user),
                "Bearer",
                jwtService.accessTtlSeconds(),
                UserResponse.from(user));
    }
}
