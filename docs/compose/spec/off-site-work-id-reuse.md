---
feature: off-site-work-id-reuse
status: in-progress
updated: 2026-11-02
source: off-site-work-id-reuse
---

# Off-site work: allow reusing document IDs of soft-deleted records

## Report

## [S1] Problem

On the Off-site work page the document number (`เลขที่เอกสาร`, e.g. `TZ001`) is
the `off_site_works.id` primary key. The create pre-check already ignores
soft-deleted rows (`findById` filters `deletedAt: null`), but a soft-deleted row
still occupies the primary key, so creating a record whose number matches a
soft-deleted record fails on `P2002` and surfaces `DUPLICATE_ID`
("มีเลขที่เอกสารนี้ในระบบแล้ว"). A document number can therefore never be reused
after its record is deleted.

## [S2] Design

Chosen behavior (user decision): **keep both rows**. A soft-deleted row is
history and must never block a new row; a new record may reuse the number of a
deleted record. A live duplicate still alerts `DUPLICATE_ID`.

### S2.1 Row identity and live-only uniqueness

- `off_site_works.row_id` (TEXT, Prisma `@default(uuid(7))`) becomes the primary
  key. `id` stays the user-supplied document number and stays immutable after
  create.
- Live-only uniqueness on the document number is enforced by a partial unique
  index `off_site_works_id_live_key ON off_site_works (id) WHERE deleted_at IS NULL`,
  plus a plain index `off_site_works_id_idx ON off_site_works (id)`
  (schema: `@@index([id])`).
- Verified empirically on PostgreSQL 17 with the repo's own `bun run check:schema`
  (`prisma migrate diff --from-config-datasource --to-schema`): the partial index
  is not representable in Prisma's schema model and is ignored by introspection,
  so it introduces no schema drift.
- Creating with a number held only by soft-deleted row(s) inserts a new row with
  a fresh `row_id`, current `postedAt`/`postedByUserId`. Deleted rows are never
  modified or removed by create.

### S2.2 Link tables: row FK plus document-number snapshot

- `expense_claim_off_site_work` and `leader_verifications` gain
  `off_site_work_row_id` (TEXT, NOT NULL) referencing `off_site_works(row_id)`
  `ON DELETE CASCADE ON UPDATE CASCADE`, with `@@index([offSiteWorkRowId])`.
- The existing `off_site_work_id` columns are retained as immutable
  document-number snapshots (always equal to the referenced row's `id`, which
  never changes). They preserve today's display, ordering, compound-key and
  email-snapshot JSON contracts: payload/UI field `offSiteWorkId` continues to
  mean the document number (URL `?offSiteWorkId=`, "เลขที่เอกสาร" labels,
  `orders[].offSiteWorkId` in email snapshots and its dashboard search).
- `expense_claim_off_site_work` keeps its PK `(expense_claim_id, off_site_work_id)`;
  `leader_verifications` keeps `@@unique([expenseClaimId, offSiteWorkId])`
  (compound lookup name `expenseClaimId_offSiteWorkId` unchanged). These still
  guarantee at most one link/verification per claim per document number.
- Both columns are NOT NULL and set explicitly on every insert/update. Prisma
  nested creates must pass both fields (the snapshot column is no longer the
  relation scalar, so it is compile-visible). No DB triggers.
- Row-exact operations — claim-link counts (`hasExpenseClaims`), the eligible
  works raw-SQL join, verification/link matching, snapshot linked/UNLINKED
  state — compare `off_site_work_row_id`, not the document-number snapshot.

### S2.3 Create semantics

- Pre-check `findById` (live only) returns `DUPLICATE_ID` when a live row holds
  the number. Unchanged message/code.
- If only soft-deleted rows hold the number, create succeeds as a brand-new row.
- Concurrent inserts of the same number: one wins; the loser's `P2002` maps to
  `DUPLICATE_ID` (existing catch).

### S2.4 Lookup and mutation semantics

- Document-number lookups (URL `?offSiteWorkId=`, `getById`, `update`, `delete`,
  claim-work selection) resolve the live row (`deletedAt: null`); the partial
  unique index guarantees at most one live row per number.
- `update`/`softDelete`/`restore` operate on `row_id` (Prisma unique-where can no
  longer use `id`). `restore` (currently dead code) stays unwired; restoring a
  number that a live row now holds fails with `P2002` → `DUPLICATE_ID`.

### S2.5 Error behavior

- Live duplicate → `DUPLICATE_ID` ("Off-site work with this ID already exists" /
  "มีเลขที่เอกสารนี้ในระบบแล้ว"). Unchanged.
- Delete guard `HAS_EXPENSE_CLAIMS` unchanged in policy, now counted per row
  (`off_site_work_row_id`) so links of another row sharing the number never
  block or allow deletion incorrectly.

### S2.6 Migration

One migration, order-sensitive:

1. Add `off_site_works.row_id` (TEXT), backfill one uuid per existing row,
   `NOT NULL`, replace PK `off_site_works_pkey(id)` with PK(`row_id`).
2. Add `off_site_work_row_id` to both link tables; backfill by joining today's
   1:1 `off_site_work_id = off_site_works.id`; `NOT NULL`; add the new FKs and
   indexes.
3. Drop the old FKs `expense_claim_off_site_work_off_site_work_id_fkey` and
   `leader_verifications_off_site_work_id_fkey` (they reference
   `off_site_works(id)`, which stops being unique). New FKs must exist before
   the old PK is dropped.
4. Create `off_site_works_id_idx` and the partial unique
   `off_site_works_id_live_key`.

Email snapshot JSON keeps storing document numbers under `orders[].offSiteWorkId`;
historical snapshots and their dashboard search stay valid.

## [S3] Out of Scope

- Renaming document numbers on existing rows (still immutable).
- The `HAS_EXPENSE_CLAIMS` policy itself (still the only delete guard).
- Restore/und-delete UX for users (none exists; `restore` stays unwired).
- Expense-claim document cancellation (`CANCELLED` soft-delete) behavior.

## Tasks

- [ ] T1: Prisma schema + migration for row identity and repointed FKs — acceptance: `bunx prisma generate` succeeds; the migration applies on a database at the previous migration head with data preserved; `bun run check:schema` exits 0 (covers: S2.1, S2.2, S2.6)
- [ ] T2: Off-site-work domain — create/update/soft-delete/restore on `row_id`, live-only duplicate handling — acceptance: unit tests show create with a soft-deleted number succeeds as a new row and live duplicates return `DUPLICATE_ID` (covers: S2.3, S2.4, S2.5) (depends: T1)
- [ ] T3: Link writes and row-exact reads in expense-claim-document, leader-verification, email-delivery — acceptance: link creation sets `offSiteWorkRowId` with the document-number snapshot; counts, joins and snapshot state are row-exact; payloads still expose `offSiteWorkId` as the document number (covers: S2.2) (depends: T1)
- [ ] T4: Regression tests — acceptance: `tests/integration/off-site-work.test.ts` proves soft-delete → create same number → both rows exist and lookups return the new live row while live duplicates still reject; suites pass (covers: S2.3, S2.4) (depends: T2, T3)
- [ ] T5: Verification — acceptance: `bun run lint`, `bun run test`, `bun run build`, `bun run test:migrations`, `bun run test:off-site-work-db` all pass (depends: T4)

## Journey log
