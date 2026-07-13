# Web UI Plan — Car Rental Marketplace (frontend)

> The web app is **client #1** of the API-first backend. This plan covers the
> **web** UI only; a mobile client is a later phase and just another consumer of
> the same REST API.

## Locked decisions

- **Stack:** full recommended (React Router v7, TanStack Query, React Hook Form + Zod, Radix UI, lucide-react, Recharts, react-day-picker).
- **Browsing:** stays **login-gated** — `/api/cars/search` is authenticated; no backend change. Landing = login/register.
- **Build order:** Phase A (foundation) → B (customer) → C (agency) → D (admin) → E (polish).

## Baseline

Existing frontend is a walking skeleton: React 19 + TS + Tailwind v4 + Vite, dev
proxy `/api → :8080`, prod `Dockerfile` + `nginx.conf`. No router, data layer,
auth, or component kit yet.

## Auth & personas (drives the whole IA)

- JWT `Authorization: Bearer <access>` — 15-min access, 7-day refresh. Refresh is a
  **JSON POST** to `/api/auth/refresh` (not a cookie); it rotates both tokens. No
  server logout (discard tokens client-side).
- Platform roles: only `CUSTOMER` and `PLATFORM_ADMIN`. **Everyone registers as
  CUSTOMER.**
- "Agency" is **not** a platform role — it's an `agencyId` + `agencyRole`
  (ADMIN/STAFF) **claim in the JWT**. A customer becomes an agency via
  `POST /api/agencies`.
- One SPA, up to **three workspaces** per account: Customer (always), Agency (JWT
  has `agencyId`), Admin (role = PLATFORM_ADMIN). Top-bar workspace switcher shows
  only entitled workspaces.
- Nearly everything requires auth (incl. search). Public: auth, health,
  `GET /api/media/**`, `/checkout.html`.
- One error shape `ApiError` (status/error/message/path/fieldErrors); every response
  has `X-Request-Id`; rate limit 120/min → 429 + `Retry-After`.

## Information architecture

```
/login  /register                    ← public
── Customer (all logged-in users) ──
/            Browse (search + filters + near-me)
/cars/:id    Car detail (gallery, reviews, availability, quote, book)
/trips       My bookings (status, cancel, review)
/account     Profile + KYC documents
── Agency (JWT has agencyId) ──
/agency               Dashboard (KPIs + charts)
/agency/cars          Fleet list + create/edit/delete
/agency/cars/:id      Manage car: edit, images, documents
/agency/bookings      Booking actions (see gap #1)
/agency/settings      Agency profile (edit = agency-ADMIN)
/agency/onboard       Create agency (when no agencyId)
── Admin (role = PLATFORM_ADMIN) ──
/admin/users          All users (read-only)
/admin/documents      KYC / doc verification queue
```

## Screens → API bindings

### Customer
| Screen | Endpoints |
|---|---|
| Register / Login | `POST /api/auth/register`, `/login`, `/refresh` |
| Browse / search | `GET /api/cars/search`, `/api/cars/search/nearby` (paged); thumbnails `GET /api/cars/{id}/images` |
| Car detail | images, `GET /api/cars/{id}/reviews`, `/availability`, `/quote` |
| Book & pay | `POST /api/bookings` (PENDING hold + `expiresAt`) → `POST /api/bookings/{id}/payment` → mock `/checkout.html` / Razorpay → poll `GET /api/bookings/{id}` until CONFIRMED |
| My trips | `GET /api/bookings`, `/{id}`, `POST /{id}/cancel` (refund preview) |
| Reviews | `POST/GET /api/bookings/{id}/review` (COMPLETED, once) |
| Profile + KYC | `GET /api/me`, `POST/GET/DELETE /api/me/kyc-documents` (multipart) |

### Agency
| Screen | Endpoints |
|---|---|
| Onboard | `POST /api/agencies` (token gotcha — gap #3) |
| Dashboard | `GET /api/agency/dashboard` (totalCars, utilization %, idleCars, revenue total/last30, fleet & booking by-status, 6-mo trends) |
| Fleet | `GET/POST/PUT/DELETE /api/agency/cars` (delete = agency-ADMIN) |
| Manage car | `.../images` (upload/list/delete), `.../documents` (INSURANCE/REGISTRATION) |
| Settings | `GET /api/agencies/me`, `PUT` (ADMIN only) |
| Bookings | `POST /api/agency/bookings/{id}/activate`, `/complete` |

### Admin
| Screen | Endpoints |
|---|---|
| Users | `GET /api/admin/users` (read-only) |
| Doc review | `GET /api/admin/documents?status=`, `POST /{id}/verify`, `/reject`; content `GET /api/documents/{id}/content` |

## Enums (for badges / state machines)

- **BookingStatus:** PENDING → CONFIRMED → ACTIVE → COMPLETED, + CANCELLED, EXPIRED
- **CarStatus:** AVAILABLE, BOOKED, MAINTENANCE, OUT_OF_SERVICE
- **KycStatus / DocumentStatus:** PENDING, VERIFIED, REJECTED
- **DocumentType:** KYC_IDENTITY, KYC_ADDRESS (user) · INSURANCE, REGISTRATION (car)
- **AgencyStatus:** PENDING, ACTIVE, SUSPENDED
- **PaymentStatus:** CREATED, CAPTURED, FAILED, REFUNDED · **PaymentType:** BOOKING, DEPOSIT, REFUND, PAYOUT

## Foundation (cross-cutting)

- **API client:** Bearer injection; 401 → one transparent `/refresh` + retry; refresh
  fail → clear session → `/login`. Normalizes `ApiError`, surfaces `X-Request-Id`,
  honors `Retry-After`.
- **Auth context:** register/login/logout, current user (`/api/me`), decodes JWT
  payload for `agencyId`/`agencyRole` (UI gating only; server still enforces).
- **Guards:** `RequireAuth`, `RequireAgency`, `RequireAdmin`.
- **Design system:** light+dark tokens; Button/Input/Select/Card/Modal/Toast/Table/
  Tabs/Pagination; status `Badge` with per-enum color map; skeletons + empty/error states.

## Build phases

- **A — Foundation:** deps, structure, API client + auth + refresh, guards, app shell +
  workspace switcher, UI kit, toasts, Login/Register.
- **B — Customer:** search/nearby → car detail → book+pay+hold countdown → trips/cancel/review → profile/KYC.
- **C — Agency:** onboarding → dashboard (charts) → fleet CRUD → images/docs → settings → booking actions.
- **D — Admin:** users list + document-review queue.
- **E — Polish:** skeletons, empty/error/responsive/a11y, optional near-me map, smoke test.

## Backend gaps that constrain the UI

1. **No agency booking list/detail endpoint** — only `activate`/`complete` by id. An
   agency "Bookings" table needs a new endpoint; interim UI acts on a known id.
2. **Browsing needs login** — search is authenticated (kept as-is by decision).
3. **Agency-creation token gotcha** — `POST /api/agencies` returns no new token, so the
   JWT lacks `agencyId` until refresh/re-login. Verify whether `/auth/refresh`
   re-derives `agencyId`; if not, force re-login after onboarding.
4. **Thin admin surface** — no agency approve/suspend, no user actions, no payout views.
   Admin ≈ users list + document review.
