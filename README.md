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
- [x] **#9** Multi-tenancy scoping (JWT carries `agencyId`/`agencyRole`; `AuthPrincipal` + `TenantContext`; `/api/agency/cars` scoped — agency sees only its own data)
- [x] **#10** Agency CRUD (API) — create (caller becomes ADMIN member), GET/PUT `/api/agencies/me` (admin-only update), GET `/api/agencies/{id}`
- [x] **#11** Car CRUD (agency-side) — `/api/agency/cars` create/list/get/update (any member), delete (ADMIN); tenant-scoped, cross-tenant access → 404, dup regNo → 409
- [x] **#12** Datafaker seed script (gated `app.seed.enabled=true`; ~1k customers, 200 agencies, 5k cars across 10 cities)

**🎉 Phase 1 complete — domain, auth, RBAC, multi-tenancy, agency/car CRUD, and bulk seed data.**

### Phase 2 — Booking engine ⭐ (crown jewel)
- [x] **#13** Booking entity + exclusion constraint (`V3`: `btree_gist`, `booking` table, `EXCLUDE` no-overlap-per-car; proven on real table). See `docs/booking-engine-internals.md`.
- [x] **#14** Availability check endpoint — `GET /api/cars/{id}/availability?from&to` (customer-facing; checks car status + active-booking overlap)
- [x] **#15** Create booking with pending hold — `POST /api/bookings` (PENDING + `expires_at`=now+10m, `@Transactional`, catches `23P01`→409); GET own bookings
- [x] **#16** Pessimistic locking variant — `POST /api/bookings/pessimistic`; `@Lock(PESSIMISTIC_WRITE)` on car (`SELECT … FOR NO KEY UPDATE`) serializes per-car, then a race-free overlap check
- [x] **#17** Optimistic locking variant — `V4` adds `car.version`; `POST /api/bookings/optimistic` force-increments it (`@Version`/`OPTIMISTIC_FORCE_INCREMENT`) and retries on conflict (TransactionTemplate, 3 attempts)
- [x] **#18** Idempotency-Key handling — `Idempotency-Key` header on `POST /api/bookings`; `V5` partial unique index on `(user_id, idempotency_key)`; retries/double-clicks return the same booking
- [x] **#19** Concurrency test (50 parallel → 1 wins) — `BookingConcurrencyTest` proves exactly-one across all 3 strategies; surfaced & fixed deadlock + pool-exhaustion handling

**🎉 Phase 2 complete — the booking engine is concurrency-safe and proven.**

### Phase 3 — Payments & lifecycle
- [x] **#20** Payment order on booking (`V6` payment table; `PaymentGateway` abstraction; `POST /api/bookings/{id}/payment` creates a `CREATED` order, idempotent per booking). Two gateways: **mock** (default, no keys) and **Razorpay** (`app.payments.provider=razorpay` + `RAZORPAY_KEY_ID/SECRET`).
- [x] **#21** Idempotent payment webhook — public `POST /api/payments/webhook`; signature-verified per gateway; capture → payment `CAPTURED` + booking `CONFIRMED`; idempotent on re-delivery
- [x] **#22** Booking lifecycle state machine — `BookingStateMachine` enforces legal transitions; webhook confirm routes through it; agency `POST /api/agency/bookings/{id}/{activate,complete}` (CONFIRMED→ACTIVE→COMPLETED); illegal moves → 409
- [ ] **#23** Pricing service (deposit, GST, fees)
- [ ] **#24** Refunds and cancellation
- [ ] **#25** Marketplace payout to agency

_Full 47-task checklist lives in the build plan; later tasks are tracked as we reach each phase._
