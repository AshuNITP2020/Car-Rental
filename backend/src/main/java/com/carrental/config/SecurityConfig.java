package com.carrental.config;

import com.carrental.auth.JwtAuthenticationFilter;
import jakarta.servlet.DispatcherType;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Stateless, JWT-based security.
 *  - No server sessions: every request authenticates from its Bearer token.
 *  - Public: auth endpoints, the health probe, and actuator.
 *  - Everything else requires a valid access token.
 */
@Configuration
@EnableConfigurationProperties({JwtProperties.class, RateLimitProperties.class})
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           StringRedisTemplate redis,
                                           RateLimitProperties rateLimit) throws Exception {
        RateLimitFilter rateLimitFilter = new RateLimitFilter(
                redis, rateLimit.enabled(), rateLimit.requestsPerMinute());

        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e.authenticationEntryPoint(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR, DispatcherType.FORWARD).permitAll()
                        .requestMatchers("/api/auth/**", "/api/health", "/actuator/**").permitAll()
                        // API docs (springdoc): browsable without a token; the
                        // endpoints themselves still require auth to invoke.
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/payments/webhook").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/media/**").permitAll()
                        // The backend also serves the built web app (SpaController +
                        // woven /static assets): the shell, its assets and the
                        // client-side routes are public GETs. Everything under /api
                        // keeps the rules above / default-deny below.
                        .requestMatchers(HttpMethod.GET,
                                "/", "/index.html", "/assets/**", "/favicon.svg",
                                "/login", "/register", "/trips", "/trips/**", "/account",
                                "/cars/**", "/agencies/**", "/agency", "/agency/**",
                                "/admin", "/admin/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("PLATFORM_ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitFilter, JwtAuthenticationFilter.class);
        return http.build();
    }

    /** BCrypt: adaptive, salted password hashing. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
