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
- [x] **#23** Pricing service (deposit, GST, fees) — `PricingService` itemizes rental + GST + deposit + platform fee; `GET /api/cars/{id}/quote`; bookings store amount (rental+GST) + deposit
- [x] **#24** Refunds and cancellation — `POST /api/bookings/{id}/cancel`; deposit-always + timing-based rental refund via gateway `refund()` (mock + Razorpay); webhook now stores captured payment id (`V7`); refund recorded as a REFUND payment row
- [x] **#25** Marketplace payout to agency — on completion, split the **rental** (excl. GST & deposit): platform keeps `platform-fee-percent`, agency receives `rental − fee` via gateway `payout()` (mock + Razorpay **Route** `transfers.create`); recorded as a `PAYOUT` row, idempotent; runs in `REQUIRES_NEW` so a payout failure never rolls back completion

**🎉 Phase 3 complete — pricing, payments, webhooks, lifecycle, refunds, and marketplace payouts (mock + Razorpay).**

### Phase 4 — Async & event-driven
- [x] **#26** Add Kafka (KRaft) + Spring Kafka — `apache/kafka:3.8.0` (KRaft, no ZooKeeper) on `:9092` in docker-compose; `spring-boot-kafka` dep + `spring.kafka.*` config; produce→consume verified through Spring then smoke code removed
- [x] **#27** Publish domain events — `DomainEvent` (PAYMENT_CAPTURED/BOOKING_CONFIRMED/CANCELLED/COMPLETED) published via `@TransactionalEventListener(AFTER_COMMIT)` → Kafka `car-rental.events` (keyed by bookingId); verified all 4 events land. (Boot 4 = Jackson 3 / `tools.jackson`.)
- [x] **#28** Notification consumer (email + FCM) — `@KafkaListener` (group `notifications`); `NotificationSender` with **log** (default) and **real SMTP email** (`app.notifications.provider=email`, Spring Mail) impls; persists `notification` rows; idempotent (`V8` unique index). FCM push still a stub.
- [x] **#29** Analytics/audit consumer — 2nd `@KafkaListener` (group `analytics`) on same topic → append-only `event_audit` (`V9`); proves consumer-group **fan-out** (both groups get every event)
- [x] **#30** Scheduled job: expire stale holds — `@EnableScheduling` + `BookingScheduler`; sweeps `PENDING` past `expires_at` → `EXPIRED`, freeing the slot
- [x] **#31** Scheduled jobs: reminders, auto-complete, reports — overdue `ACTIVE` → `COMPLETED` (+payout); pickup reminders via `BOOKING_REMINDER` event; nightly status report

**🎉 Phase 4 complete — event-driven (Kafka publish + fan-out consumers) and time-based (scheduled jobs).**

### Phase 5 — Search, geo & caching
- [x] **#32** Search endpoint (filters, sort, pagination) — `GET /api/cars/search` (customer-facing, cross-tenant). Optional, AND-combined filters: `city`/`category` (case-insensitive), `q` (free text over make·model), `minPrice`/`maxPrice`, and a `from`/`to` availability window (excludes cars with an overlapping BLOCKING booking); always restricted to AVAILABLE cars. `sort=price|newest[,asc|desc]` (allow-listed, `id` tiebreaker); `page`/`size` (≤100) returning a reusable `PageResponse<T>`. New `com.carrental.search` module (keeps the `car`↔`booking` packages cycle-free); `V10` adds `lower(city)`/`lower(category)` functional indexes for the case-insensitive filters.
- [x] **#33** PostGIS geo search — `GET /api/cars/search/nearby?lat=&lng=&radiusKm=` ("cars near me"), AVAILABLE cars within the radius ordered nearest-first, with the same optional `category`/`q`/`minPrice`/`maxPrice` and `from`/`to` availability filters as `#32`. `V11` adds a `car.geog geography(Point,4326)` STORED generated column (derived from `longitude`/`latitude`, so it never drifts and the entity needn't map it) plus a GiST index; a native query uses PostGIS `ST_DWithin` (radius), `ST_Distance` (the reported `distanceKm`) and the `<->` operator (nearest-first ordering).
- [x] **#34** Redis caching + invalidation — non-availability car searches (`GET /api/cars/search` without a `from`/`to` window) are cached in Redis via Spring Cache (`@Cacheable` keyed by the criteria, JSON values, bounded TTL `app.cache.search-ttl-seconds`=60). Availability-window searches are skipped (time-sensitive, low hit-rate). Invalidation is coarse-but-correct: `@CacheEvict(allEntries=true)` on every `CarService`/`AgencyService` write (the only writes that change which AVAILABLE cars a search returns — bookings never mutate `car.status`). A custom `RedisCacheManager` uses a **synchronous** writer (`immediateWrites(true)`) so eviction is read-your-writes — Boot's default Lettuce writer is async, which would let a write be followed by a stale hit.
- [x] **#35** Rate limiting + validation hardening — a Redis-backed **fixed-window rate limiter** (`RateLimitFilter`, in the security chain after JWT auth) caps each client (authenticated user id, else remote IP) at `app.rate-limit.requests-per-minute`=120 per 60s window, returning **429 + `Retry-After`** on breach; it fails *open* (a Redis hiccup never blocks traffic) and skips the payment webhook + health probe. Plus a global `@RestControllerAdvice` (`ApiExceptionHandler`) that maps every failure to one `ApiError` JSON shape — bean-validation → 400 with per-field messages, `ResponseStatusException` reasons surfaced (Boot hides them by default), unexpected errors → 500 without leaking internals.

**Phase 5 complete.**

### Phase 6 — Dashboard & media
- [x] **#36** Car image upload (S3/R2) — a pluggable `ObjectStorage` abstraction (same swap-behind-config pattern as the payment gateway/notification sender): the default `local` provider writes to disk and serves bytes back via `GET /api/media/**` (zero setup), while the `s3` provider (`app.storage.provider=s3`, AWS SDK v2) targets S3 / Cloudflare R2 / MinIO with presigned GET URLs. `V12` adds a `car_image` child table (order + content type + storage key). Agency-scoped management under `/api/agency/cars/{carId}/images` (multipart upload, list, delete — image-type + size + count validated, tenant-checked) and a customer read at `/api/cars/{carId}/images`.

  <details><summary><b>Running the S3 path locally with MinIO</b></summary>

  MinIO (S3-compatible, no AWS account) is in `docker-compose.yml`. Start it and create the bucket:
  ```
  docker compose up -d minio createbuckets   # API :9000, console :9001 (minioadmin/minioadmin)
  ```
  Then run the backend with the `s3` provider pointed at it (values are in `.env.example`):
  ```
  STORAGE_PROVIDER=s3 STORAGE_S3_ENDPOINT=http://localhost:9000 \
  STORAGE_S3_BUCKET=car-images STORAGE_S3_REGION=us-east-1 \
  STORAGE_S3_ACCESS_KEY=minioadmin STORAGE_S3_SECRET_KEY=minioadmin ./gradlew bootRun
  ```
  Uploads now go into MinIO and image URLs are presigned MinIO links. `S3ObjectStorageTest` verifies this round trip (it self-skips when MinIO isn't up). The default (no env vars) stays `local` — nothing required.
  </details>
- [x] **#37** KYC/insurance document upload — **private** documents (contrast with #36's public images): a generic `document` table (`owner_type` USER/CAR + `owner_id` + `doc_type` + review `status`) reusing `ObjectStorage` under a private key prefix. Users upload their own KYC docs (`/api/me/kyc-documents`), agencies upload a car's insurance/registration (`/api/agency/cars/{carId}/documents`). Bytes are served **only** through an authenticated `GET /api/documents/{id}/content` that re-checks authorization per request (owner, the car's agency, or platform admin) — never the public `/api/media` path, never a shareable presigned URL; non-owners get 404 (existence hidden). Platform-admin review at `/api/admin/documents` verify/reject, with KYC decisions propagating to `user.kycStatus`. `V13` adds the table.
- [x] **#38** Agency dashboard analytics — `GET /api/agency/dashboard` (tenant-scoped, any agency member) returning a single snapshot built from **aggregation queries** (no entity loading): fleet counts by `CarStatus`, booking counts by `BookingStatus`, **revenue** (rental amount of realized CONFIRMED/ACTIVE/COMPLETED bookings — all-time + last-30-days), **utilization %** (distinct cars with a blocking booking spanning *now* ÷ fleet), **idle cars** (AVAILABLE with no realized booking ending in the last 30 days), and a **6-month trend** (bookings + realized revenue per month via a native `date_trunc` group-by). Queries live in a dedicated `DashboardRepository`; all filtered by `agencyId` so an agency only sees its own numbers.
- [x] **#39** Reviews and ratings — a `review` table (one per booking, `rating` 1–5 + comment, `car_id` denormalized for aggregation; `V14`). A customer reviews their own booking only, only once, and only after it's **COMPLETED** (`POST/GET /api/bookings/{bookingId}/review`). Per-car aggregation (`GET /api/cars/{carId}/reviews`) returns the review list plus the **average rating + count** (a single indexed aggregation over `car_id`). Guard rails: not-completed → 409, duplicate → 409, someone else's booking → 404, rating out of range → 400.

**Phase 6 complete.** _Full 47-task checklist lives in the build plan; later tasks are tracked as we reach each phase._
