# syntax=docker/dockerfile:1

FROM oven/bun:1.4.0 AS base

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

# Source and generated Prisma client are shared by the ops jobs and email worker.
FROM dependencies AS migrator

COPY . .
RUN bunx prisma generate

CMD ["bunx", "prisma", "migrate", "deploy"]

FROM migrator AS email-worker

ENV NODE_ENV=production
USER bun

CMD ["bun", "scripts/email-worker.ts"]

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
