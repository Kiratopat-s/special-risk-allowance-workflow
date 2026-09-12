# Database migrations and schema verification

## Notification soft-delete repair

Commit `7833a94` added `Notification.isDeleted`, `Notification.deletedAt`, and their index to the Prisma schema without adding a SQL migration. A database with all 22 older migrations applied can therefore report that its migration history is current while still failing notification queries.

`20260912072555_add_notification_soft_delete` adds:

- `notifications.is_deleted BOOLEAN NOT NULL DEFAULT false`
- `notifications.deleted_at TIMESTAMP(3) NULL`
- `notifications_user_id_is_deleted_created_at_idx` on `(user_id, is_deleted, created_at)`

The migration is transactional and additive. Existing notifications remain visible, with their original read states and content. Push subscriptions are untouched. Existing soft-delete filters remain in place.

## Normal workflow

Create schema changes and a corresponding migration together, using a disposable development database:

```bash
bunx prisma migrate dev --name describe_the_change
bunx prisma generate
bun run test:migrations
bun run test
bun run lint
```

Never edit an already-applied migration. Commit the new migration alongside the schema change. `prisma generate` only generates the client; it does not update database tables. `migrate status` checks migration history, not whether the actual database matches the Prisma schema.

`bun run test:migrations` requires Docker and Node on PATH. It creates a uniquely named PostgreSQL **17.7** container with a random password and a random loopback-only port, constructs its own test URLs, and removes the container and temporary files on completion or termination. It ignores the application's `DATABASE_URL` and never runs the application seed against a real database.

The test replays the migration history before the notification repair, inserts sample data, verifies that the old schema fails readiness and schema validation, then upgrades and checks data preservation and repository behavior. It also tests a fresh installation and a repeated migration deployment. The integration tests are separate from the normal Vitest suite so `bun run test` never needs a real database.

## Applying and verifying migrations

First confirm that `DATABASE_URL` selects the intended environment. Apply the committed migrations, then compare the actual database with the Prisma schema:

```bash
bunx prisma migrate status
bunx prisma migrate deploy
bun run check:schema
```

`check:schema` is read-only. Exit code **0** means no differences, **2** means drift remains, and **1** means inspection failed. Never suppress a nonzero exit code in deployment.

The GitHub CI and deployment validation jobs run migration regression tests. The environment deployment workflow applies migrations and runs `check:schema` in the migrator container **before** replacing the app container. A failure stops that rollout. The existing app is not replaced.

Equivalent server commands, with the same environment, image tag, and Compose project used for that deployment:

```bash
docker compose --profile ops run --rm migrate
docker compose --profile ops run --rm migrate bun run check:schema
docker compose up -d app
```

The `/api/health` endpoint now checks the notification columns with `LIMIT 0`. It reads no notification rows and returns only `{ "status": "ok" }` or `{ "status": "unavailable" }`, using HTTP 200 or 503 respectively.

## Databases that were manually patched

Before applying the new migration to an environment that may have used `db push` or manual SQL, inspect the actual definitions in the configured schema:

```sql
SELECT column_name, data_type, is_nullable, column_default, datetime_precision
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'notifications'
  AND column_name IN ('is_deleted', 'deleted_at');

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'notifications'
  AND indexname = 'notifications_user_id_is_deleted_created_at_idx';
```

If both columns and the index are absent, apply the migration normally. If **all three** definitions match the migration exactly, record the already-completed change and verify the whole schema:

```bash
bunx prisma migrate resolve --applied 20260912072555_add_notification_soft_delete
bun run check:schema
```

Do not mark the migration applied when an object is missing or differs in type, default, nullability, precision, index uniqueness, column order, or predicate. Stop and inspect the discrepancy. Partial or failed migrations require a reviewed repair based on their actual database state; do not blindly rerun SQL or mark them successful.

Do not reset a populated database, delete its migration history, or use `db push` as a production repair. If application rollback is needed after this additive migration, leave the columns in place and roll back the application image rather than deleting data-bearing columns.

This repair addresses schema readiness and notification persistence. VAPID keys, browser permissions, and end-to-end push delivery are separate checks.

## Repair verification — 12 September 2026

The migration was applied to the configured development database after confirming that both columns and the index were absent. A comparison of all original notification and push-subscription values before and after migration was unchanged. The development database had no notification rows and one push subscription; populated notification preservation was verified separately using isolated fixtures.

After migration, `bun run check:schema` reported no differences, `notificationService.getPageState` succeeded against the development database, and the health handler returned HTTP 200 with `{ "status": "ok" }`.

Validation passed: 291 regular tests, 10 migration integration test executions across the previous, upgraded, and fresh schemas, lint, TypeScript, and the webpack production build. The default Turbopack build encountered the existing sandbox restriction on binding its CSS-worker port. UAT and production deployments were not executed; their next rollout uses the migration and schema-check steps described above.
