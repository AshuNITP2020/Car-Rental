# 🚗 Car Rental Marketplace

A learning-first project: a two-sided car-rental marketplace that fuses a
booking/reservation engine with a fleet-management SaaS. The goal is to learn
what it takes to build a real product **end-to-end** — the business idea is
deliberately "solved" so all energy goes into engineering.

> Build to learn, not to earn.

## What it does

A two-sided marketplace connecting **customers** who want to rent a car with
**agencies** that own fleets, refereed by a **platform**:

- **Customers** — plan a trip **Uber-style** (pickup + destination city, dates,
  optional **one-way drop-off** with a distance-based fee), choose among
  **agencies** (rating, fleet, from-price), see live
  availability, **book with a guarantee of no double-booking**, pay (rental +
  GST + refundable deposit), cancel with timing-based refunds, and review a trip
  once it's completed.
- **Agencies (fleet owners)** — register, manage their fleet and car images,
  upload KYC / insurance documents, and see a **dashboard** (revenue,
  utilisation, idle cars, monthly trends). On each completed trip they receive a
  **marketplace payout** (rental minus the platform's commission).
- **Platform admin** — verifies KYC/documents and oversees the marketplace,
  which earns a commission on every booking.

Under the hood it behaves like a real product: **event-driven** notifications
and audit (Kafka), **scheduled** lifecycle jobs (hold expiry, auto-complete,
reminders, nightly reports), **caching + rate limiting**, full **observability**,
and **graceful degradation** when a dependency fails.

## Guiding principles

- **API-first, always.** The backend owns 100% of business logic behind a
  clean, token-authed REST API. The web app is *client #1*; any future client
  (e.g. a mobile app) is just another consumer of the same API.
- **The booking engine is the crown jewel.** Preventing double-booking under
  concurrency is the hardest, most instructive piece — design it first.
- **Make it feel real.** Seed thousands of rows, simulate traffic, inject
  failure, watch dashboards.
- **Each phase introduces a constraint that forces a new concept.**

## Stack

| Layer | Choice |
|-------|--------|
| Backend | **Spring Boot 4.1 (Java 17)** — Web MVC, Data JPA, Security, Validation, Actuator, Cache, Kafka, Mail |
| Build & packaging | **Gradle** · Docker (multi-stage images) |
| Database | **PostgreSQL 16 + PostGIS** · Flyway migrations (V1–V14) · Hibernate `ddl-auto=validate` |
| Cache, locks &amp; rate-limiting | **Redis** (Lettuce) · Spring Cache |
| Events / async | **Apache Kafka** (KRaft) · `@TransactionalEventListener` → Kafka consumer-group fan-out |
| Scheduled jobs | Spring `@Scheduled` — hold expiry, auto-complete, reminders, nightly reports |
| Auth | **JWT** (access + refresh) · BCrypt · role- and tenant-scoped |
| Object storage | **Local disk** (default) · **S3 / Cloudflare R2 / MinIO** (AWS SDK v2, presigned URLs) |
| Payments | **Mock** (default, no keys) · **Razorpay Route** (orders, webhooks, refunds, payouts) |
| Notifications | **Log** (default) · **SMTP email** (Spring Mail) |
| Web frontend | React 19 + TypeScript + Tailwind v4 (Vite) — *currently a walking skeleton* |
| Observability | Actuator + Micrometer → **Prometheus + Grafana** · structured JSON logs (ECS) + `X-Request-Id` correlation |
| Resilience | Rate limiting · fail-open cache/limiter · fail-fast Redis timeout · chaos-tested |
| CI/CD | **GitHub Actions** (test → build → publish to GHCR) · `docker-compose.prod.yml` |
| Scaling | Stateless app tier · opt-in read-replica read/write routing |
| Load &amp; chaos tooling | **k6** load test · Node traffic simulator · dependency-kill chaos script |
| Testing | **JUnit 5** against live docker-compose Postgres / Redis / Kafka |

## Architecture

**Modular monolith** — one deployable Spring Boot backend with cleanly separated
modules (`auth` · `user`/KYC · `agency` · `car`/catalog · `booking` · `payment` ·
`search` · `dashboard` · `review` · `notification` · `events` · `storage`),
splittable into services later.

- **State** lives outside the app: **Postgres** is the system of record, **Redis**
  holds the search cache + rate-limit counters, and **object storage** holds car
  images &amp; documents.
- **Domain events** flow through **Kafka** to independent consumer groups
  (`notifications`, `analytics`) — the same event fans out to both.
- The app tier is **stateless** (JWT auth, shared stores), so it scales
  **horizontally** behind a load balancer; read-heavy traffic can be offloaded to
  a Postgres **read replica** via opt-in read/write routing.

```
        React web app ──HTTP──▶  Spring Boot backend  ──▶  PostgreSQL + PostGIS
                                   │   │   │                Redis (cache/limits)
                                   │   │   └──▶ Object storage (images/docs)
                                   │   └──▶ Kafka ──▶ notifications + analytics
                                   └──▶ Actuator/Micrometer ──▶ Prometheus + Grafana
```

## Getting started

**Prerequisites:** JDK 17, Docker + Docker Compose, Node 20. Dev defaults are in
`.env.example` (never used in production).

```bash
# 1. start dev infra (Postgres+PostGIS, Redis, Kafka, MinIO, Prometheus, Grafana)
docker compose up -d

# 2. run the backend (Spring Boot on :8080) — from backend/
cd backend && ./gradlew bootRun
#    optional: bulk-seed ~1k customers / 200 agencies / 5k cars
#    ./gradlew bootRun --args='--app.seed.enabled=true'

# 3. run the web frontend (Vite dev server on :5173) — from frontend/
cd frontend && npm install && npm run dev

# run the test suite (needs infra up) — from backend/
./gradlew test
```

For production-style container deployment (built images + CI/CD), see
[`deploy/README.md`](deploy/README.md).

## Project structure

```
backend/     Spring Boot API — the product's brain (modules under com.carrental.*)
frontend/    React + Vite web client (walking skeleton for now)
docs/        Deep-dives: booking engine, object storage, CI/CD & scaling
monitoring/  Prometheus config + Grafana provisioning & dashboards
loadtest/    k6 load test (search hot path)
simulator/   Node traffic-generator bot
chaos/       Dependency-kill resilience script
deploy/      Deploy & CI/CD guide
.github/     CI + image-publish workflows
docker-compose.yml         dev infrastructure
docker-compose.prod.yml    production-style stack (built images)
```

## Documentation

| Doc | What it covers |
|-----|----------------|
| [`docs/booking-engine-internals.md`](docs/booking-engine-internals.md) | The concurrency-safe booking engine (exclusion constraint, locking, idempotency) |
| [`docs/object-storage-and-minio.html`](docs/object-storage-and-minio.html) | Object storage abstraction &amp; running MinIO locally |
| [`docs/ci-cd-and-scaling.html`](docs/ci-cd-and-scaling.html) | CI/CD, deployment &amp; scaling — from-zero explainer + interview prep |
| [`deploy/README.md`](deploy/README.md) | How to deploy, update &amp; roll back |
