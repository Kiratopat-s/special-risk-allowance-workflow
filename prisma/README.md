# Prisma data model

The PostgreSQL schema is the persistence layer for a revision-first special-risk
allowance workflow. The repository intentionally uses a clean baseline: there
is no legacy claim/MRC compatibility migration or data backfill.

## Aggregate boundaries

- `OffSiteWork` owns normalized `OffSiteWorkParticipant` rows. Once a submitted
  claim references the record, its dates, participants, and leader are locked.
- `ExpenseClaim` is the logical one-per-user/month lifecycle record.
  `ExpenseClaimRevision` owns immutable submitted OSW snapshots, primary work
  dates, holiday results, and We Safe metadata.
- `LeaderVerification` belongs to one revision/OSW pair. Confirmed and
  superseded payload/signature snapshots are historical records.
- `MonthlyRequestCollection` is scoped by department/month. Membership is kept
  in `MonthlyRequestCollectionItem`; item/date/code fields become the official
  snapshot at finalization.
- `ClaimReviewFlag` and `UserActionLog` preserve collector review and audit
  history. `MrcReplacementSource` links voided documents to their replacement
  Draft.

## Database-only invariants

The baseline migration adds partial unique indexes that Prisma cannot express:

- one non-cancelled claim per user/month;
- one Draft MRC per department/month;
- one active MRC membership per claim;
- one OPEN suspicious flag per claim; and
- one active replacement per off-site-work record.

It also adds checks for canonical month dates, fixed `150.00` rates, six-digit
employee snapshots, submitted We Safe length, complete frozen MRC items, valid
date ranges, and status metadata. Database triggers protect submitted revision
snapshots and enforce participant/date/primary-OSW scope; domain services add
authorization, current-revision, confirmation, totals, and lifecycle checks in
the same transaction as each command.

## Commands

```bash
bunx prisma format
bunx prisma validate
bunx prisma generate
bunx prisma migrate dev --name <name>
bunx prisma db seed
bun run db:seed:uat
```

The optional UAT seed creates 20 deterministic claimants and 60 claims across
June–August 2026. Every claim contains 15–28 dates; most claimants share the
same 22-day pattern, while selected rows demonstrate longer, shorter, shifted,
multi-off-site-work, and duplicate-WeSafe cases for Collector comparison. The
seed uses its own `UAT-LARGE-*` namespace and is idempotent while those fixtures
remain in their emitted shape. Existing finalized UAT monthly requests outside
that namespace are preserved. If testers add append-only review history or
correction revisions to these fixed claims, reset the explicitly selected test
database before loading the fixtures again.

## PostgreSQL integration tests

The constraint suite under `tests/integration` is opt-in and only reads
`TEST_DATABASE_URL`; it never falls back to the application's `DATABASE_URL`.
Point it at a disposable PostgreSQL database that already has the clean-break
baseline migration applied, then run:

```bash
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/sraw_test?schema=public" bun run test:integration
```

When `TEST_DATABASE_URL` is absent, Bun reports the suite as skipped. Every test
opens a transaction and rolls it back, including expected constraint failures,
so fixtures are not committed to the test database.

`prisma migrate reset` is destructive and is only appropriate for an explicitly
selected local/test database. Production uses `prisma migrate deploy`.

Application components and server actions must call domain services. Only
repositories should issue Prisma queries.
