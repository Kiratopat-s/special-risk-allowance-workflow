# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Base & Build Stages (Bun toolchain)
# -----------------------------------------------------------------------------
FROM oven/bun:1.4.4 AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS builder

COPY . .
ARG DEPLOYMENT_VERSION
ARG GIT_COMMIT_SHA
RUN DEPLOYMENT_VERSION="$(bun scripts/deployment-version.mjs)" \
    && export DEPLOYMENT_VERSION \
    && bunx prisma generate \
    && bun run build

# -----------------------------------------------------------------------------
# Ops & Worker Targets (Bun)
# -----------------------------------------------------------------------------
FROM dependencies AS migrator

COPY . .
RUN bunx prisma generate

CMD ["bunx", "prisma", "migrate", "deploy"]

FROM migrator AS email-worker

ENV NODE_ENV=production
USER bun

CMD ["bun", "scripts/email-worker.ts"]

# -----------------------------------------------------------------------------
# Production Runner: Zero-CVE Hardened Target
# -----------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Distroless puts node at /nodejs/bin/node outside PATH (only the entrypoint finds
# it). Expose it by name so exec-form commands like the compose healthcheck work.
ENV PATH=/nodejs/bin:$PATH

# In distroless:nonroot, uid:gid 65532:65532 is pre-configured
COPY --from=builder --chown=nonroot:nonroot /app/public ./public
COPY --from=builder --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /app/.next/static ./.next/static

# nonroot is the default user in this tag, explicitly set for clarity
USER nonroot

EXPOSE 3000

# Next.js standalone entry point via node
CMD ["server.js"]
