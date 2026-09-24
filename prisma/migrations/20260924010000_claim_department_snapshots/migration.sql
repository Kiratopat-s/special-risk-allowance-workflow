CREATE TYPE "DepartmentSnapshotSource" AS ENUM ('SUBMISSION', 'LEGACY_CURRENT');

ALTER TABLE "expense_claims"
  ADD COLUMN "department_snapshot_id" TEXT,
  ADD COLUMN "department_snapshot_name" TEXT,
  ADD COLUMN "department_snapshot_short_name" TEXT,
  ADD COLUMN "department_snapshot_captured_at" TIMESTAMP(3),
  ADD COLUMN "department_snapshot_source" "DepartmentSnapshotSource";

CREATE INDEX "expense_claims_department_snapshot_id_expense_month_idx"
  ON "expense_claims"("department_snapshot_id", "expense_month");

-- Existing records intentionally remain uncaptured. After deploying snapshot-aware
-- writers, run node scripts/backfill-department-snapshots.mjs --apply to attribute legacy
-- submitted records to their current department, explicitly marked LEGACY_CURRENT.
