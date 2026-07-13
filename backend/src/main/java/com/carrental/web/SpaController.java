package com.carrental.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the built-in web app (the Vite build woven into /static by the
 * {@code weaveFrontendIntoStatic} gradle task): every client-side route
 * forwards to the SPA shell so deep links and refreshes work when the backend
 * serves the frontend directly on :8080.
 *
 * <p>Add new top-level SPA routes here AND to the matching permitAll list in
 * {@code SecurityConfig}. API routes all live under /api and are unaffected.
 * When the frontend isn't woven (API-only builds), these forwards 404 — harmless.
 */
@Controller
public class SpaController {

    @GetMapping({
            "/", "/login", "/register",
            "/trips", "/trips/**",
            "/account",
            "/cars/**",
            "/agencies/**",
            "/agency", "/agency/**",
            "/admin", "/admin/**"
    })
    public String spa() {
        return "forward:/index.html";
    }
}
