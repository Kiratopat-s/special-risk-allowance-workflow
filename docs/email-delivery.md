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
requires HTTPS. `EMAIL_PORT` defaults to 587, with implicit TLS on port 465.

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

## Operations

Super administrators can inspect email delivery history in
`/admin/notifications` and retry an eligible failed job after its cause is fixed.
Server-side authorization applies to both history reads and retries. Successful
or obsolete jobs cannot be resent using this action. Review pending job age,
failed jobs, and container health after rollout. Error details are sanitized;
credentials, full SMTP responses, and bearer tokens must not appear in logs or
the administrator page.

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
during SMTP delivery. CI runs it before deployment.
