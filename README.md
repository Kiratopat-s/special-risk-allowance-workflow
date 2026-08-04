# Special Risk Allowance Workflow

Special Risk Allowance Workflow is a Next.js application for managing PEA special-risk allowance operations from off-site work records through expense claims, leader verification, monthly collection, multi-stage approval, signatures, and notifications.

## What It Does

- Records off-site work used as evidence for special-risk allowance claims.
- Creates and tracks individual expense claim documents for selected work dates.
- Requests leader verification from internal leaders or external leaders through one-time links.
- Collects eligible expense claims into monthly request collections.
- Runs monthly collections through a three-stage approval flow: `HPA_CHECK`, `RK_CHECK`, then `OK_APPROVE`.
- Stores active user signatures and prints them into approval documents.
- Provides role-based access control, audit logging, in-app notifications, web push, and SMTP email for verification links.

## Tech Stack

- Next.js 16 App Router and React 19
- TypeScript with strict mode
- Tailwind CSS v4 and shadcn-style UI primitives
- Auth.js v5 with Keycloak
- Prisma 7 with PostgreSQL and `@prisma/adapter-pg`
- Bun 1.3.14 for dependency management and scripts
- Nodemailer for email and Web Push API for browser notifications

## Project Structure

```text
app/                         Route pages, layouts, API routes, and server actions
components/                  Shared React components and UI primitives
lib/auth.ts                  Auth.js Keycloak configuration and session mapping
lib/auth/                    Auth events and permission helpers
lib/db/                      Prisma singleton and database exports
lib/domains/                 Repository-service domain modules
lib/generated/prisma/        Generated Prisma client, ignored by git
lib/hooks/                   Client hooks for permissions, session, and notifications
lib/shared/                  Shared types, result helpers, formatting, and sanitizers
prisma/                      Schema, migrations, seed script, and Prisma config
public/                      PWA manifest, service worker, fonts, logos, and static assets
graphify-out/                Derived code graph artifacts
```

Domain modules follow the same shape:

```text
lib/domains/<domain>/
  index.ts
  types.ts
  repository.ts
  service.ts
```

Application code should call services from `lib/domains/*`. Repositories own database queries, services own business rules, and service methods use the shared `Result<T>` pattern.

## Core Domains

- `user` - Keycloak-synced users, profile data, login/logout events, and status changes.
- `department` - Organization hierarchy and department lookup.
- `permission` - RBAC permissions, roles, scopes, guards, and seed data.
- `off-site-work` - Off-site work records and attached source files.
- `expense-claim-document` - Claim creation, submission, status changes, and collection readiness.
- `leader-verification` - Internal leader queues and public token verification links.
- `monthly-request-collection` - Monthly claim collection, approval steps, and printable documents.
- `signature` - User signature capture, activation, and retrieval.
- `notification` - Persisted notifications and push subscriptions.
- `action-log` - Audit trail records.

## Default Roles

The seed script creates these system roles:

| Role | Purpose |
| --- | --- |
| `employee` | Creates own off-site work, expense claims, and signatures. |
| `collector` | Collects claims into monthly request collections and manages MRC records. |
| `hpa` | Reviews monthly request collections at the `HPA_CHECK` stage. |
| `rk` | Reviews monthly request collections at the `RK_CHECK` stage. |
| `drt` | Performs final approval at the `OK_APPROVE` stage. |
| `super-admin` | Full system administration. |

## Requirements

- Bun `1.3.14` or compatible
- PostgreSQL
- A Keycloak realm and client for Auth.js
- Optional SMTP credentials for external leader verification email
- Optional VAPID keys for browser push notifications

## Environment Variables

Create a local `.env` file. Environment files are ignored by git.

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sraw?schema=public"

NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="replace-with-a-strong-secret"
AUTH_KEYCLOAK_ID="keycloak-client-id"
AUTH_KEYCLOAK_SECRET="keycloak-client-secret"
AUTH_KEYCLOAK_ISSUER="https://keycloak.example.com/realms/your-realm"

EMAIL_HOST=""
EMAIL_PORT="587"
EMAIL_USER=""
EMAIL_PASS=""
EMAIL_FROM="Special Risk Allowance Workflow <noreply@example.com>"

VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:admin@example.com"
```

Notes:

- `DATABASE_URL`, `AUTH_SECRET`, and the `AUTH_KEYCLOAK_*` values are required for a functional authenticated app.
- `NEXTAUTH_URL` should match the public base URL. For local HTTPS, set it to the `bun devh` URL.
- Email is skipped when SMTP values are missing.
- Push notifications are disabled when VAPID keys are missing.

## Local Setup

Install dependencies:

```bash
bun install
```

Generate the Prisma client:

```bash
bunx prisma generate
```

Apply local migrations:

```bash
bunx prisma migrate dev
```

Seed default permissions and roles:

```bash
bunx prisma db seed
```

Start the development server:

```bash
bun dev
```

Open `http://localhost:3000`.

For local HTTPS on `local.sraw.space`, use:

```bash
bun devh
```

Make sure `local.sraw.space` resolves to your local machine and update `NEXTAUTH_URL` accordingly.

## Common Commands

| Command | Description |
| --- | --- |
| `bun install` | Install dependencies from `bun.lock`. |
| `bun dev` | Start the Next.js development server. |
| `bun devh` | Start development with experimental HTTPS on `local.sraw.space`. |
| `bun run lint` | Run ESLint with Next.js and TypeScript rules. |
| `bun run build` | Create a production build. |
| `bun run start` | Serve the production build. |
| `bunx prisma generate` | Regenerate the Prisma client. |
| `bunx prisma migrate dev --name <name>` | Create and apply a local migration. |
| `bunx prisma migrate deploy` | Apply migrations in production. |
| `bunx prisma db seed` | Seed default roles, permissions, and role-permission mappings. |
| `bunx prisma studio` | Inspect and edit local data. |

## Workflow Overview

1. Users authenticate through Keycloak. Profile claims are synchronized into the local `User` table.
2. Employees create off-site work records and prepare expense claim documents.
3. Submitted claims create leader verification records when linked off-site work has leaders.
4. Internal leaders verify through their queue; external leaders verify through a public one-time token link.
5. Verified or pending claims become eligible for collector-managed monthly request collections.
6. Monthly collections move through `HPA_CHECK`, `RK_CHECK`, and `OK_APPROVE` approval steps.
7. Approved documents can be printed with stored signatures and audit context.

## Database Notes

- Prisma schema lives in `prisma/schema.prisma`.
- Migrations live in `prisma/migrations/`.
- The Prisma client is generated into `lib/generated/prisma/` and is intentionally ignored by git.
- Database access should stay inside domain repositories.
- Use migrations for schema changes; do not edit the database manually for application schema updates.

After schema changes, run:

```bash
bunx prisma migrate dev --name <descriptive_name>
bunx prisma generate
```

## Authentication And Authorization

Authentication is configured in `lib/auth.ts` using Keycloak. The JWT callback maps Keycloak claims into the session, including profile, employee, position, department, and local database user identifiers.

Authorization is handled through permission helpers in `lib/auth/permissions.ts`. Check permissions at server-action boundaries and prefer resource/action checks over hardcoded role checks unless the feature is explicitly role-only.

## Notifications

The notification system stores in-app notification records and can deliver browser push notifications when users subscribe through the service worker. SMTP email is used for external leader verification links.

Operational behavior:

- Missing SMTP config logs a warning and skips email delivery.
- Missing VAPID config logs a warning and skips web push delivery.
- Invalid push subscriptions are removed automatically when push services return unrecoverable status codes.

## Quality Checks

No automated test framework is configured yet. Before opening a PR or deploying, run:

```bash
bun run lint
bun run build
```

For risky changes, manually verify the affected workflow, especially:

- Keycloak sign-in and profile synchronization
- Permission-gated server actions
- Prisma migrations and seed behavior
- Expense claim submission and leader verification
- Monthly collection approval steps
- Signature capture and print pages
- Notifications, email, and push subscriptions

## Deployment

This project is deployed as a Docker Compose application that connects to an
existing PostgreSQL instance. It does not create or manage a database
container. The host's existing reverse proxy terminates HTTPS and forwards
requests to the app on localhost.

### Server setup

Install Docker Engine with the Docker Compose plugin, clone the repository on
the server, then create the untracked production environment file:

```bash
cp deploy/env.production.example .env
chmod 600 .env
```

Set every required value in `.env`. Do not commit or copy this file into the
repository. `DATABASE_URL` must reference a database host reachable from the
container, and `NEXTAUTH_URL` must be the public HTTPS URL.

### Deploy and update

From the repository root on the server, run:

```bash
git pull --ff-only
docker compose --env-file .env build app migrate
docker compose --env-file .env --profile ops run --rm migrate
docker compose --env-file .env up -d --remove-orphans app
docker compose --env-file .env ps
docker compose --env-file .env logs -f app
```

For a newly provisioned database, or after a deliberate change to the default
roles and permissions, run the idempotent seed job after migrations and before
starting the app:

```bash
docker compose --env-file .env build migrate
docker compose --env-file .env --profile ops run --rm seed
```

Check readiness through the host proxy or locally on the server:

```bash
curl --fail http://127.0.0.1:3000/api/health
```

The app container has no persistent volume: application files are immutable
and uploaded document content is stored in PostgreSQL. Migrations and seeds
are explicit operator actions and never run when the app container starts.

### Reverse proxy and Keycloak

Configure the host reverse proxy to forward to
`http://127.0.0.1:${APP_PORT}` and preserve `Host`, `X-Forwarded-For`,
`X-Forwarded-Host`, and `X-Forwarded-Proto` headers. Terminate TLS at the
proxy; do not expose the Compose port publicly.

In Keycloak, register this valid redirect URI:

```text
${NEXTAUTH_URL}/api/auth/callback/keycloak
```

Also set the client web origin to the public `NEXTAUTH_URL` value.

Before a rollback, confirm that the database migration is backward-compatible.
Then restore the prior Git revision or image tag and run `docker compose up -d
app`; do not attempt to roll back production Prisma migrations automatically.

## Troubleshooting

- `Cannot find module "@/lib/generated/prisma/..."`: run `bunx prisma generate`.
- Authentication redirects or callback errors: verify `NEXTAUTH_URL`, Keycloak client settings, issuer URL, and callback URLs.
- Permission denied for a user who should have access: confirm the user has a seeded role and matching permission scope.
- Email links are not sent: check `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, and `NEXTAUTH_URL`.
- Push notifications do not arrive: check VAPID keys, service worker registration, browser permission, and stored push subscriptions.
