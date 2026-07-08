# Deploy & CI/CD

How this project goes from a `git push` to a running server, and how to run it
yourself. Three moving parts:

```
  git push ──▶ CI (test)  ──▶ Publish images (GHCR)  ──▶ Deploy (docker compose)
              ci.yml           deploy.yml                 docker-compose.prod.yml
```

---

## 1. Continuous Integration — `.github/workflows/ci.yml`

Runs on **every push and pull request**. Two parallel jobs:

| Job | What it does |
|---|---|
| `backend-test` | Boots **Postgres/PostGIS + Redis + Kafka** as service containers and runs the full JUnit suite against them (the tests use live infra, not mocks). Uploads the HTML test report as an artifact. |
| `frontend-build` | `npm ci` then `npm run build` (`tsc -b && vite build`) — fails the build on a type error or broken bundle. |

The flaky `BookingConcurrencyTest` (50 threads racing optimistic locks) is
retried up to 2× **on CI only** — see the `retry {}` block in
`backend/build.gradle`, gated on the `CI=true` env var GitHub Actions sets. Local
`./gradlew test` stays strict (0 retries).

## 2. Publish images — `.github/workflows/deploy.yml`

Runs on **push to `main`** and on **`v*` tags**. Builds both Dockerfiles with
Buildx (layer cache in GitHub Actions cache) and pushes to the **GitHub
Container Registry**:

```
ghcr.io/<owner>/car-rental-backend
ghcr.io/<owner>/car-rental-frontend
```

Tags applied: the branch name, the commit `sha`, `latest` (on the default
branch), and the semver (`1.2.3`) on a `v1.2.3` tag. Auth uses the built-in
`GITHUB_TOKEN` (`packages: write`) — **no secret to configure**. After the first
successful run, make the packages public (or keep them private and
`docker login ghcr.io` on the server).

## 3. Deploy — `docker-compose.prod.yml`

Runs the **built images** plus Postgres, Redis and Kafka on one host, addressing
each other by service name. On any Docker host / VM:

```bash
# one-time
git clone https://github.com/AshuNITP2020/Car-Rental.git && cd Car-Rental
cp .env.prod.example .env.prod
#   edit .env.prod: set POSTGRES_PASSWORD and a long random JWT_SECRET
#   (openssl rand -base64 48)

# pull the published images and start everything
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

# the app is now on http://<host>/  (frontend nginx proxies /api to the backend)
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Flyway runs the migrations automatically on first backend boot (the PostGIS
image ships the extension, so baseline-on-migrate works exactly as in dev).

### To build locally instead of pulling
```bash
docker compose -f docker-compose.prod.yml build      # uses backend/Dockerfile + frontend/Dockerfile
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

### Update / rollback
```bash
# update to newest images
docker compose --env-file .env.prod -f docker-compose.prod.yml pull && \
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

# pin/rollback to a specific build (any tag CI produced — a sha or vX.Y.Z)
BACKEND_IMAGE=ghcr.io/<owner>/car-rental-backend:sha-abc1234 \
  docker compose --env-file .env.prod -f docker-compose.prod.yml up -d backend
```

---

## Required configuration

| Variable | Where | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | `.env.prod` | DB password (Postgres + backend). **Required.** |
| `JWT_SECRET` | `.env.prod` | ≥ 32 bytes. **Required.** `openssl rand -base64 48` |
| `BACKEND_IMAGE` / `FRONTEND_IMAGE` | `.env.prod` | Default to `:latest` on GHCR; pin a tag for reproducible deploys. |
| `STORAGE_*`, `PAYMENTS_*`, `NOTIFICATIONS_*` | `.env.prod` | Optional; default to local disk / mock / log. See `.env.prod.example`. |

`.env.prod` is gitignored (`.env.*`) — secrets never land in the repo. In CI/CD
nothing extra is needed; production secrets live only on the deploy host.

## Images (containerization)

- **`backend/Dockerfile`** — multi-stage: JDK stage builds the `bootJar` (with a
  warmed dependency cache), slim JRE stage runs it as a **non-root** user with a
  `MaxRAMPercentage` heap and an Actuator-based `HEALTHCHECK`.
- **`frontend/Dockerfile`** — Node stage builds the Vite bundle, nginx stage
  serves the static files and reverse-proxies `/api` + `/actuator` to `backend`
  (`frontend/nginx.conf`) — the prod analogue of Vite's dev proxy.

## Managed-platform alternative (no VM to run)

Each image is a standard OCI container, so any container host works. For a
zero-server option, point a PaaS at this repo:

- **Render / Railway / Fly.io** — create a service from `backend/Dockerfile`, add
  managed Postgres + Redis add-ons, and set the same env vars as `.env.prod`.
  Deploy the frontend as a static site (build `npm run build`, publish `dist/`)
  or as the nginx image.

## Caveat on the project's dev machine

`docker-compose.prod.yml` uses normal container↔container networking. On this
project's dev host the Docker bridge blocks that traffic (documented in the repo
docs / memory), so the full prod stack won't talk to itself **here** — validate
locally with `docker compose -f docker-compose.prod.yml config` and run the real
thing on a proper VM/host, where bridge networking behaves normally.
