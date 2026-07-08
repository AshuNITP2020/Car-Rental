# syntax=docker/dockerfile:1
#
# Production image for the Spring Boot backend (Task #45).
# Multi-stage: a JDK stage compiles the bootJar, a slim JRE stage runs it.
# Tests are NOT run here (they need a live Postgres/Redis — that's the CI job);
# the image build only packages the jar with `-x test`.

# ---- Stage 1: build the executable jar with the Gradle wrapper ----
FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

# Copy the wrapper + build scripts FIRST and warm the dependency cache, so an
# edit to src/ doesn't force a full re-download of dependencies on rebuild.
COPY gradlew ./
COPY gradle ./gradle
COPY settings.gradle build.gradle ./
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies >/dev/null 2>&1 || true

# Now the sources, then build. `-x test` skips tests (CI runs those against
# real infra); this stage just needs to produce the jar.
COPY src ./src
RUN ./gradlew --no-daemon clean bootJar -x test \
 && cp build/libs/backend-*.jar /workspace/app.jar

# ---- Stage 2: minimal runtime ----
FROM eclipse-temurin:17-jre AS runtime
WORKDIR /app

# curl is only needed for the container HEALTHCHECK below. Create a non-root
# user and the writable dirs the app uses (local image storage + JSON logs).
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system spring && useradd --system --gid spring spring \
 && mkdir -p /app/data /app/logs && chown -R spring:spring /app

COPY --from=build --chown=spring:spring /workspace/app.jar /app/app.jar

USER spring
EXPOSE 8080

# Let the JVM size its heap from the container's memory limit instead of the
# host's total RAM. Override at runtime with -e JAVA_OPTS=...
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"

# Report health via Spring Boot Actuator (already exposed at /actuator/health).
# `curl -f` fails on a non-2xx status, and Actuator returns 503 when the aggregate
# health is DOWN — so keying off the HTTP status is correct (grepping the body for
# "status":"UP" would spuriously match a nested component while the app is DOWN).
# start-period covers Flyway migrations + context startup on first boot.
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS http://localhost:8080/actuator/health >/dev/null || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
