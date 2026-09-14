# Special Risk Allowance Workflow

Special Risk Allowance Workflow is a Next.js application for managing PEA special-risk allowance operations from off-site work records through expense claims, leader verification, monthly collection, multi-stage approval, signatures, and notifications.

## What It Does

- Records off-site work used as evidence for special-risk allowance claims.
- Prefills new off-site work records from travel-order PDFs, with local extraction and review before saving.
- Creates and tracks individual expense claim documents for selected work dates.
- Requests leader verification from internal leaders or external leaders through one-time links.
- Collects eligible expense claims into monthly request collections.
- Completes monthly collections with one `HPA_CHECK` approval and a saved signing snapshot. RK/OK sign later in the organization’s document system.
- Stores active user signatures and prints them into approval documents.
- Provides role-based access control, audit logging, in-app notifications, web push, and SMTP email for verification links.

## PDF Import

In **เพิ่มคำสั่ง**, choose **เลือก PDF**, review the extracted fields, then select **นำข้อมูลลงฟอร์ม**. Manually edited fields are protected by default. Review incomplete Thai glyphs marked `�`, check the traveler list, choose a supervisor, and save normally. The browser reads the PDF locally; only employee codes are sent for account matching. PDF bytes and preview files are not uploaded or stored.

The first version supports text PDFs from the existing travel-order system, one document at a time, up to 10 MB and 20 pages. Scans and password-protected PDFs require manual entry. Travelers without an account are retained using their employee code and editable document details. Exact matches to ACTIVE accounts are linked on save, after Keycloak sync, and before loading eligible claim options. Existing links and historical details are preserved.

`bun dev`, `bun devh`, and `bun run build` prepare a version-matched PDF.js worker under the ignored `public/pdfjs/` directory. Direct Next.js invocation requires `bun run prepare:pdf` first. No database migration or external OCR service is required.

Run `bun run test` for parser, reader, review interaction, authorization, and domain tests. Run `bun run test:off-site-work-db` for the account lifecycle and concurrent JSON updates; it creates and removes its own PostgreSQL Docker container and never uses the application database. The **Off-site work** scene in `bun tests/visual/serve-ui-alignment.mjs` provides a local browser preview with saving and account searches mocked.

## Tech Stack

- Next.js 16 App Router and React 19
- TypeScript with strict mode
- Tailwind CSS v4 and shadcn-style UI primitives
- Auth.js v5 with Keycloak
- Prisma 7 with PostgreSQL and `@prisma/adapter-pg`
- Bun 1.4.0 for dependency management and scripts
- Node.js 24 LTS for Vitest and jsdom
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
| `rk` | Reads and prints approved monthly collections; signs in the organization document system. |
| `drt` | Reads and prints approved monthly collections; signs in the organization document system. |
| `super-admin` | Full system administration. |

## Requirements

- Bun `1.4.0`, matching `packageManager` in `package.json`
- Node.js 24 LTS (`24.15.0` or newer) on `PATH` for the test toolchain
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

Seed default departments, permissions, and roles:

```bash
bunx prisma db seed
```

Department seeds skip exact name/short-name matches. If either unique field belongs
to a different pairing (including a missing short name), the seed reports the
requested values and conflicting records, leaves them unchanged, and continues
with the remaining departments.

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
| `bun run test` | Run Vitest using Node.js. |
| `bun run build` | Create a production build. |
| `bun run start` | Serve the production build. |
| `bunx prisma generate` | Regenerate the Prisma client. |
| `bunx prisma migrate dev --name <name>` | Create and apply a local migration. |
| `bunx prisma migrate deploy` | Apply migrations in production. |
| `bunx prisma db seed` | Seed default departments, roles, permissions, and role-permission mappings; report department conflicts. |
| `bunx prisma studio` | Inspect and edit local data. |

## Dependency Maintenance

Use `bun install --frozen-lockfile` in CI and deployments, and commit `package.json` and `bun.lock` together after updates. Select stable releases within compatible major versions, keep `next` and `eslint-config-next` aligned, and pin `prisma`, `@prisma/client`, and `@prisma/adapter-pg` to the same version. Check release tags before using `bun update --latest`: Prisma's `latest` tag pointed to an 8.0 release candidate during the September 2026 update.

Two security overrides remain because Prisma 7.10.0 still pins vulnerable transitive dependencies:

- `mysql2: ^3.24.4` replaces Prisma's pinned 3.15.3 and includes the [compressed-protocol fix](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) and [authentication fix](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr).
- `deepmerge-ts: ^8.0.2` replaces `@prisma/config`'s pinned 7.1.5 with the [recursive-merge fix](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). This crosses a major version, so verify Prisma configuration loading and client generation when changing it.

Remove these overrides once Prisma's own dependency ranges include patched versions. Use bounded ranges for overrides; an open-ended `>=` can silently select an incompatible major. The previous Babel, Fast URI, Flatted, js-yaml, and Picomatch overrides are no longer needed with the refreshed lockfile.

Compatibility constraints retained in this update:

- Auth.js remains exactly pinned to `5.0.0-beta.32`, an explicit prerelease exception because the app uses its v5 APIs. Moving to stable NextAuth v4 requires an authentication migration. Its optional Nodemailer peer range covers versions 7 and 8; this app uses Keycloak authentication and calls patched Nodemailer 9 directly for SMTP. Review compatibility before enabling an Auth.js email provider.
- ESLint 9.39.5 is deprecated upstream but remains the compatible major for `eslint-plugin-react` 7.37.5, whose peer range excludes ESLint 10. Upgrade them together when support is available.
- TypeScript remains on 5.9.3; the refreshed `typescript-eslint` 8.70.0 requires TypeScript below 6.1, excluding TypeScript 7.

After dependency updates, run:

```bash
bun install --frozen-lockfile
bun audit
bunx prisma generate
bun run lint
bun run test
bun run build
# With Docker running, verify Prisma against disposable databases:
bun run test:migrations
```

## Workflow Overview

1. Users authenticate through Keycloak. Profile claims are synchronized into the local `User` table.
2. Employees create off-site work records and prepare expense claim documents.
3. Submitted claims create leader verification records when linked off-site work has leaders.
4. Internal leaders verify through their queue; external leaders verify through a public one-time token link.
5. Verified or pending claims become eligible for collector-managed monthly request collections.
6. HPA (or super-admin) approves and signs at `HPA_CHECK`, atomically setting the collection and linked claims to `APPROVED`. The collector prints/saves the PDF and submits it to the organization document system for RK/OK signing.
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

Vitest covers domain services, authorization, UI interactions, and official print output. Before opening a PR or deploying, run:

```bash
bun run test
bun run lint
bun run build
```

Keep Node.js on `PATH` and use `bun run test`, without `--bun`. Bun remains the package manager, while Vitest and its forked jsdom workers run on Node. If Node is missing, Bun can silently substitute its own runtime; the Vitest configuration rejects that setup with an actionable error. Both CI test jobs install Node 24 LTS and the Bun version from `package.json`, and print their versions in the job log.

The suite defaults to two workers because concurrent MUI/jsdom renders can exhaust CPU and memory on shared laptops and CI runners, causing otherwise passing UI tests to hit the five-second timeout. The timeout and test isolation remain unchanged. To tune concurrency for a larger machine, use `bun run test --maxWorkers=<count>`.

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
export DEPLOYMENT_VERSION="$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
export IMAGE_TAG="$DEPLOYMENT_VERSION"
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
curl --fail http://127.0.0.1:3000/api/version
```

Generate a fresh deployment version for every image build, including rebuilds of
the same revision. Keep the exported image tag through the deploy commands. The
Docker build embeds this version in the server and browser;
changing runtime environment variables cannot change an already built version.
GitHub Actions generates a version from the revision, UTC timestamp, run ID, and
attempt, passes `github.sha` directly as `GIT_COMMIT_SHA`, uses an immutable image
tag, and verifies `/api/version` after startup.
Keep the previous image tag for rollback; do not rebuild it under the same tag.

If `DEPLOYMENT_VERSION` is omitted, Docker generates it from `GIT_COMMIT_SHA` or
the checkout's commit metadata, plus the UTC build time and a random suffix.
Plain `docker build .` and `docker compose build app` work from a normal Git
checkout without exporting a version. Only HEAD, branch refs, and packed refs
are allowed into the build context; Git config, hooks, credentials, and history
remain excluded, and the runtime image contains no Git metadata. Cached builds
reuse the existing image and version; a fresh compilation gets a fresh version.
For source archives or worktrees whose Git directory is outside the build
context, pass `--build-arg GIT_COMMIT_SHA="$(git rev-parse HEAD)"` explicitly.
For a BuildKit remote Git URL context, use
`--build-arg BUILDKIT_CONTEXT_KEEP_GIT_DIR=1` to make the commit metadata available.

Tabs check the version when visible, on focus, and once per minute while visible.
When a new build is detected, a persistent refresh notice appears, including
inside edit dialogs. Further Server Actions stop until the user refreshes; inputs
remain available to copy and submissions are never replayed automatically. Tabs
opened before this recovery code was deployed need one manual refresh. An
unavailable version endpoint is ignored; it does not prove that a build changed.

Keycloak department sync matches both name and short name. It reuses a single
matching record without renaming it. If the two fields identify different rows,
sign-in continues and synchronizes other profile fields, preserving existing
department membership or leaving a new account unassigned. Server warnings tagged
`[department-sync]` report the incoming values, matching records, and sync source.
Resolve these discrepancies in the department/Keycloak data deliberately; seeds
retain their stricter conflict-reporting behavior. Storage failures prevent a new
application session and send the user to a retryable sign-in error page.

Run `bun run test:department-db` to test sign-in and seed concurrency using a
disposable PostgreSQL container. It never uses the application's database.

To repeat the two-build browser recovery check locally, build disposable images:

```bash
node scripts/build-deployment-fixture.mjs check-a
node scripts/build-deployment-fixture.mjs check-b
docker run --rm -d --name sraw-recovery-check -p 127.0.0.1:3301:3000 -e AUTH_SECRET=local-validation-only sraw-deployment-validation:check-a
```

Open `http://127.0.0.1:3301/deployment-validation`, submit once, then type an
unfinished draft. Keep the tab open while replacing its container:

```bash
docker stop sraw-recovery-check
docker run --rm -d --name sraw-recovery-check -p 127.0.0.1:3301:3000 -e AUTH_SECRET=local-validation-only sraw-deployment-validation:check-b
```

The notice should appear on the next visible-tab check or failed old action.
Verify the draft stays intact and further submissions stop. Copy the draft,
click the notice's refresh button, and submit it on build B. The result should
show build B with `submissions: 1`. Stop the test container with
`docker stop sraw-recovery-check` when finished. The fixture has no database
access and is injected only into these validation images; never deploy them.
Normal application builds do not contain its route.

After rollout, verify `/api/version` matches the image's build version and
review `[department-sync]` warnings and missing-action errors after users refresh.

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
- Missing database columns despite an up-to-date migration status: run `bun run check:schema` and follow the [migration and schema-verification guide](docs/database-migrations.md). CI also runs `bun run test:migrations` against disposable PostgreSQL.

### Single-HPA approval cutover

The single-stage workflow stores signature bytes, signer name and position at approval time. Reprinting uses that snapshot, even after profile/signature changes. RK/DRT keep read/list permissions but can only see approved collections; management and HPA permissions retain their broader access. `MANAGE` alone does not grant signing rights.

Deploy migration `20260914140000_single_hpa_approval` before starting the updated app, then run `bunx prisma generate`. The migration checks for legacy RK/OK steps or already approved steps and aborts without changing documents if any exist. Review such data before deployment; do not reset the database or mark the migration applied manually. No legacy approval conversion is provided because this release assumes no real signed documents exist. Use `bun run test:migrations` for disposable PostgreSQL upgrade/fresh-install checks; it never uses the application database.

The migration withdraws retired review grants and RK/DRT submit/approve grants. Updated permission seeds do not recreate them. Deprecated enum values remain only for migration compatibility. No external document API or delivery tracking is added.
