# Internal leader email delivery

New internal leader verification requests create durable email jobs in the same
PostgreSQL transaction as their verification records. Email is sent in addition
to the existing in-app and push notifications, regardless of push subscription or
delivery results. Recipients come only from the assigned internal user's
`User.email`; `peaEmail` and copied external-leader addresses are not fallbacks.
The address is re-read before each attempt, with the attempted address retained
in history. Several orders for the same leader and claim generation share one
email. No periodic reminder messages are created.
Existing requests are not backfilled when the migration is deployed. External
leader token emails keep their existing behavior.

Each message points to the authenticated leader queue. It contains no bearer
token, signature, or attachment. Delivery history records SMTP acceptance, which
does not prove inbox delivery or that the recipient read the message. SMTP can
accept a message immediately before a worker crashes; retry recovery can therefore
produce a duplicate despite stable message IDs and database deduplication.

## Configuration and local use

The worker uses the existing `DATABASE_URL`, `NEXTAUTH_URL`, `EMAIL_HOST`,
`EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM` environment variables.
Keep credentials in the deployment secret store. `NEXTAUTH_URL` must be an
absolute application URL and must point to the correct environment; production
requires HTTPS. An absent, empty or whitespace-only `EMAIL_PORT` defaults to 587,
with implicit TLS on port 465. An absent, empty or whitespace-only `EMAIL_FROM`
defaults to `ระบบ SRAW <noreply@pea.co.th>`.

```bash
bunx prisma generate
bun run email:worker --check-config
bun run email:worker
```

The configuration check validates configuration without accessing the database
or contacting SMTP. It does not prove that the SMTP server is reachable or will
accept mail. Running the worker normally processes eligible queued messages, so
use a local SMTP capture server and a disposable test database during development.

## Deployment and rollback

The `email-worker` Docker target uses the pinned Bun runtime, installed
dependencies, application TypeScript source and generated Prisma client. The
Next.js standalone application image does not contain this worker runtime.

Deploy the application and worker from the same immutable image tag:

```bash
export DEPLOYMENT_VERSION="$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
export IMAGE_TAG="$DEPLOYMENT_VERSION"
docker compose --env-file .env build app migrate email-worker
docker compose --env-file .env run --rm --no-deps email-worker bun scripts/email-worker.ts --check-config
docker compose --env-file .env --profile ops run --rm migrate
docker compose --env-file .env --profile ops run --rm migrate bun run check:schema
docker compose --env-file .env up -d app email-worker
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 app email-worker
```

GitHub Actions performs the same configuration preflight before migrations,
starts both services, waits for both container health checks, then verifies the
application build version. SMTP configuration is required for a successful worker
rollout. Preflight failure leaves the running services in place.

The worker has no published port. Its health check reads
`http://127.0.0.1:3101/health` inside the container. Readiness describes the worker
loop and database access; it does not confirm inbox delivery. Docker's restart
policy restarts an exited worker; an unhealthy but running container requires
operator attention.

To pause delivery deliberately, stop only `email-worker`; committed email jobs
remain in PostgreSQL. Resume it after fixing configuration or service access.
The worker stops taking jobs on termination and has a 70-second container grace
period to finish its active attempt. Expired leases make interrupted work eligible
for recovery after an unclean stop.

For rollback, keep the previous application and worker image tags and confirm
schema compatibility. Restart both services with the previous `IMAGE_TAG`;
never automatically reverse the database migration or delete queued/history
records. When reverting to a release predating email delivery, stop the worker
and restore only the older app; preserve the outbox for a subsequent compatible
release.

## Troubleshooting configuration preflight

The deployment step **Validate email worker configuration without sending mail**
checks local configuration only. A failure here does not establish an SMTP
connection problem, rejected credentials, an unavailable database, or a conflict
on health port 3101: those connections and the health listener have not started.
The workflow stops before migrations or service replacement, leaving the existing
running services in place.

Check the GitHub Environment selected by the deployment: pushes to `main` use
`uat`; `prod-*` tags use `production`. The reusable deployment job reads the
following exact settings. A value stored as a Secret is not read by a `vars.*`
mapping, and a value stored as a Variable is not read by a `secrets.*` mapping.

| Setting | GitHub source used by the workflow | Requirement |
| --- | --- | --- |
| `EMAIL_HOST` | Variable: `vars.EMAIL_HOST` | SMTP hostname, required |
| `EMAIL_PORT` | Variable: `vars.EMAIL_PORT` | Optional; defaults to 587; otherwise an integer from 1 to 65535 |
| `EMAIL_FROM` | Variable: `vars.EMAIL_FROM` | Optional; otherwise one valid sender mailbox, optionally with a display name |
| `NEXTAUTH_URL` | Variable: `vars.NEXTAUTH_URL` | Absolute application URL; HTTPS is required in the deployed worker |
| `EMAIL_USER` | Secret: `secrets.EMAIL_USER` | SMTP username, required |
| `EMAIL_PASS` | Secret: `secrets.EMAIL_PASS` | SMTP password, required |
| `DATABASE_URL` | Secret: `secrets.DATABASE_URL` | Valid PostgreSQL connection URL, required |

Both the Docker worker image and Compose set `NODE_ENV=production`. This includes
the `uat` deployment, so an HTTP `NEXTAUTH_URL` fails preflight there as well.
Use the public HTTPS application URL for that environment. The older external
leader email path could silently skip missing SMTP settings; it did not impose
this worker's startup validation. A previously successful app deployment therefore
does not establish that all worker settings are present and valid.

The CLI now reports all detected configuration issues using safe field-specific
codes, without printing their values. For example:

```text
EMAIL_USER_REQUIRED
NEXTAUTH_URL_HTTPS_REQUIRED
DATABASE_URL_INVALID
```

Correct each reported setting in its mapped GitHub Variable or Secret and rerun
the deployment. Missing required values use codes such as `EMAIL_HOST_REQUIRED`,
`EMAIL_USER_REQUIRED`, `EMAIL_PASS_REQUIRED`, `NEXTAUTH_URL_REQUIRED` and
`DATABASE_URL_REQUIRED`. Malformed host, port, sender or URL settings use
`EMAIL_HOST_INVALID`, `EMAIL_PORT_INVALID`, `EMAIL_FROM_INVALID`,
`NEXTAUTH_URL_INVALID` or `DATABASE_URL_INVALID`. Blank optional sender and port
values use their defaults and do not fail validation by themselves.

An older log containing only `WORKER_STARTUP_FAILED` does not identify which
setting was missing or invalid. Do not infer a particular missing value from that
message; use the updated preflight output. For a manually configured environment,
run `bun run email:worker --check-config`, or the Docker preflight command above.
A successful check confirms local syntax and required values only. SMTP
reachability, authentication and actual delivery still require a controlled UAT
delivery test.

## Operations

Super administrators can inspect the worker dashboard at `/admin/email-worker`,
open each job's recipient and attempt history, and retry an eligible failed job
after its cause is fixed. The email history entry in `/admin/notifications` links
to this dashboard. Server-side authorization applies to dashboard reads, details
and retries. Successful or obsolete jobs cannot be resent using this action.
Review jobs ready to run, delayed retries, failures, expired processing leases,
oldest ready-job age and SMTP acceptances in the last 24 hours after rollout.
Error details are sanitized;
credentials, full SMTP responses, and bearer tokens must not appear in logs or
the administrator page.

Every worker process generates a new run ID. It registers in PostgreSQL and
records an independent heartbeat every 30 seconds, successful queue polling,
the current job, safe runtime error codes and graceful shutdown. These records
use database time; monitoring failures are best effort and do not change job
leases or send outcomes. Attempt history links to the worker run that acquired
the attempt. Email rejections belong to that attempt and do not by themselves
mean the worker process stopped.

| Dashboard worker state | Meaning |
| --- | --- |
| `STARTING` | Registered recently; no successful queue poll observed yet |
| `IDLE` | Recent heartbeat and queue progress; no current job |
| `PROCESSING` | Recent signals and a current job |
| `DEGRADED` | A safe runtime error was recorded after the most recent successful poll |
| `STALLED` | Heartbeats continue, but queue progress has been absent for more than 90 seconds |
| `STOPPING` | Graceful shutdown started and the heartbeat has not gone stale |
| `STOPPED` | Graceful shutdown was recorded |
| `NO_SIGNAL` | No observed worker run, or its last heartbeat is more than 90 seconds old |

A stale heartbeat cannot distinguish a stopped process from lost database
connectivity. Configuration validation failures happen before registration and
cannot appear as a specific database-backed runtime error. If no run appears,
inspect the deployment preflight and container logs using the troubleshooting
steps above. The private container health endpoint and dashboard serve different
purposes: health gates deployment readiness; recorded heartbeats allow the app
to display worker status without exposing a worker port. Old runs remain visible
as history and do not establish that a worker is currently running.

New jobs and attempts retain recipient and document context snapshots for later
inspection, including when the original request or user changes. Historical
rows predating the dashboard migration keep null snapshots and null worker run
IDs; the migration does not reconstruct history or enqueue older requests.
Where current source context is available for an old row, the dashboard labels
it as current data rather than an original attempt snapshot. SMTP acceptance is
the success shown here; it is not an inbox receipt or read confirmation.

Transient failures retry after 1 minute, 5 minutes, 15 minutes, 1 hour and 6 hours,
for at most six send attempts per retry cycle. Permanent rejection, invalid
configuration or an inactive/invalid recipient fails the job for administrator
review. Each attempt checks that its original verification requests are still
pending, linked, unexpired and applicable; obsolete jobs are skipped. Manual
retry starts a new cycle and retains previous attempts and the requesting
administrator's identity. History survives deletion of the original claim or
user and has no automatic cleanup in this release.

Before rollout, use UAT and a designated test mailbox to confirm the authenticated
link, correct recipient, UTF-8 Thai content, and visibility of failures. Exercise
worker restart during delivery and confirm queued work resumes. These checks send
mail and should use controlled test recipients.

## Verification

```bash
bun run lint
bun run test
bun run test:email-db
bun run build
```

`test:email-db` creates a disposable PostgreSQL container and constructs its own
database URLs. It never uses the application's `DATABASE_URL` or an external
SMTP server. A local SMTP capture fixture receives messages without forwarding
them. The suite checks upgrade/fresh migration behavior, no backfill, atomic
enqueue, deduplication, concurrent claims, lease recovery, eligibility changes,
retry outcomes, retained delivery history, and an actual worker crash/restart
during SMTP delivery. It also checks worker registration, progress, stale signals,
graceful stopping, recovery after monitoring failure and additive upgrade of
pre-existing deliveries and attempts without inventing snapshots or worker runs.
CI runs it before deployment.
