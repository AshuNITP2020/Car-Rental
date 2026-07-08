# syntax=docker/dockerfile:1
#
# Production image for the React/Vite frontend (Task #45).
# Stage 1 builds the static bundle; stage 2 serves it with nginx and reverse-
# proxies /api and /actuator to the backend container.

# ---- Stage 1: build the static site ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps from the lockfile first (cached until the lockfile changes).
COPY package.json package-lock.json ./
RUN npm ci

# Build (tsc -b && vite build) -> /app/dist
COPY . .
RUN npm run build

# ---- Stage 2: serve with nginx ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx's default entrypoint/cmd runs the server in the foreground.
