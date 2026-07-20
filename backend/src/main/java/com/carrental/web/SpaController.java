package com.carrental.web;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.server.ResponseStatusException;

/**
 * Serves the built-in web app (the Vite build woven into /static by the
 * {@code weaveFrontendIntoStatic} gradle task): every client-side route
 * forwards to the SPA shell so deep links and refreshes work when the backend
 * serves the frontend directly on :8080.
 *
 * <p>Add new top-level SPA routes here AND to the matching permitAll list in
 * {@code SecurityConfig}. API routes all live under /api and are unaffected.
 * In API-only builds (frontend not woven) these paths 404 cleanly instead of
 * forwarding into a missing resource.
 */
@Controller
public class SpaController {

    /** Whether the SPA shell was woven into this build (checked once). */
    private final boolean spaPresent = new ClassPathResource("static/index.html").exists();

    @GetMapping({
            "/", "/login", "/register",
            "/destinations",
            "/trips", "/trips/**",
            "/account",
            "/cars/**",
            "/agencies/**",
            "/agency", "/agency/**",
            "/admin", "/admin/**"
    })
    public String spa() {
        if (!spaPresent) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found");
        }
        return "forward:/index.html";
    }
}
