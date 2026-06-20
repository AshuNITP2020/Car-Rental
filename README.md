# 🚗 Car Rental Marketplace

A learning-first project: a two-sided car-rental marketplace that fuses a
booking/reservation engine with a fleet-management SaaS. The goal is to learn
what it takes to build a real product **end-to-end** — the business idea is
deliberately "solved" so all energy goes into engineering.

> Build to learn, not to earn.

## Guiding principles

- **API-first, always.** The backend owns 100% of business logic behind a
  clean, versioned, token-authed API. The website is *client #1*; a mobile app
  later is *client #2*.
- **The booking engine is the crown jewel.** Preventing double-booking under
  concurrency is the hardest, most instructive piece — design it first.
- **Make it feel real.** Seed thousands of rows, simulate traffic, inject
  failure, watch dashboards.
- **Each phase introduces a constraint that forces a new concept.**

## Stack

| Layer | Choice |
|-------|--------|
| Backend | Spring Boot (Java 17 LTS) — Web, Data JPA, Security |
| Build | **Gradle** + Docker |
| Database | PostgreSQL + PostGIS, Flyway migrations |
| Cache / locks | Redis |
| Events | Apache Kafka |
| Scheduled jobs | JobRunr / `@Scheduled` |
| Object storage | S3 / R2 |
| Payments | Razorpay (Route) |
| Notifications | FCM + Spring Mail (Mailtrap/SES) |
| Web frontend | React + TypeScript + Tailwind (Vite) |
| Mobile (later) | React Native + Expo |
| Observability | Actuator + Micrometer → Prometheus + Grafana |
| Testing | JUnit 5 + Mockito + Testcontainers · Playwright · k6 |

## Architecture

Modular monolith to start (one deployable backend, cleanly separated modules:
auth · catalog · booking · payments · agency · reviews · notify), splittable
into services later.

## Roadmap — 47 tasks across 9 phases

Worked **one at a time, lowest ID first**. Each task is a vertical slice you
can finish in a sitting; you can stop after any task with a working system.

| Phase | Tasks | Focus |
|-------|-------|-------|
| **P0** Foundation & walking skeleton | #1–5 | repo, docker-compose, scaffolds, one end-to-end slice |
| **P1** Domain, auth & multi-tenancy | #6–12 | entities, Flyway, JWT, RBAC, agency/car CRUD, seed |
| **P2** Booking engine ⭐ *crown jewel* | #13–19 | exclusion constraint, holds, locking, idempotency, concurrency test |
| **P3** Payments & lifecycle | #20–25 | Razorpay orders/webhooks/refunds/payouts, pricing, state machine |
| **P4** Async & event-driven | #26–31 | Kafka events, consumers, scheduled jobs |
| **P5** Search, geo & caching | #32–35 | filters/pagination, PostGIS, Redis cache, rate limiting |
| **P6** Dashboard & media | #36–39 | image/KYC upload (S3), analytics, reviews |
| **P7** Ship, observe & stress | #40–45 | Prometheus/Grafana, logs/tracing, traffic sim, k6, chaos, CI/CD |
| **P8** Mobile & scale *(optional)* | #46–47 | React Native + FCM, read replicas, service split |

## Status

- [x] **#1** Confirm JDK 17 + init Git repo
- [x] **#2** Scaffold Spring Boot backend (`backend/`, Spring Boot 4.1, Gradle, runnable; `/actuator/health` → UP)
- [x] **#3** Scaffold React frontend (`frontend/`, React + TS + Tailwind v4 + Vite, runs on :5173)
- [x] **#4** docker-compose: Postgres + Redis (PostGIS image on host `:55432`, Redis `:6379`; both healthy)
- [x] **#5** Walking skeleton (React → `/api/health` → Spring → Postgres `now()`, verified end-to-end)

**🎉 Phase 0 complete — the full stack is wired and proven end-to-end.**

### Phase 1 — Domain, auth & multi-tenancy
- [x] **#6** Core entities + first Flyway migration (`V1__core_entities.sql`: users, agency, agency_member, car; JPA entities; Hibernate `ddl-auto=validate`)
- [x] **#7** JWT auth (register/login/refresh; Spring Security stateless, BCrypt, access+refresh tokens, `/api/me`)
- [x] **#8** RBAC roles and guards (`V2` adds platform `role`; JWT `role` claim → authority; `@PreAuthorize` + URL guard on `/api/admin/**`)
- [ ] **#9** Multi-tenancy scoping
- [ ] **#10** Agency CRUD (API + UI)
- [ ] **#11** Car CRUD (agency-side)
- [ ] **#12** Datafaker seed script

_Full 47-task checklist lives in the build plan; later tasks are tracked as we reach each phase._
