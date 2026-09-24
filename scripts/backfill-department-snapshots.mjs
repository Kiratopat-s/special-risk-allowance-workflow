import { pathToFileURL } from "node:url";
import { Client } from "pg";

// A single conditional UPDATE is atomic and idempotent. A concurrently submitted
// draft with a real snapshot is never overwritten after waiting for its row lock.
export const backfillDepartmentSnapshotsSql = `
  UPDATE expense_claims AS claim
  SET department_snapshot_id = department.id,
      department_snapshot_name = department.name,
      department_snapshot_short_name = department.short_name,
      department_snapshot_captured_at = CURRENT_TIMESTAMP,
      department_snapshot_source = 'LEGACY_CURRENT'::"DepartmentSnapshotSource"
  FROM users AS claimant
  LEFT JOIN departments AS department ON department.id = claimant.department_id
  WHERE claim.user_id = claimant.id
    AND claim.status <> 'DRAFT'
    AND claim.department_snapshot_source IS NULL
    AND claim.department_snapshot_captured_at IS NULL
`;

export async function backfillDepartmentSnapshots(client) {
  const result = await client.query(backfillDepartmentSnapshotsSql);
  return result.rowCount;
}

async function main() {
  if (process.versions.bun) {
    throw new Error("Run this deployment script with node; Bun automatically loads .env files.");
  }
  const mode = process.argv[2];
  if (!["--dry-run", "--apply"].includes(mode) || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/backfill-department-snapshots.mjs --dry-run|--apply (explicit DATABASE_URL required; .env is not loaded)");
  }
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL explicitly for the intended deployment database.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    if (mode === "--apply") {
      const count = await backfillDepartmentSnapshots(client);
      console.log(`Captured ${count} legacy department snapshots. Existing snapshots and drafts were preserved.`);
    } else {
      const result = await client.query(`SELECT COUNT(*)::integer AS count FROM expense_claims
        WHERE status <> 'DRAFT' AND department_snapshot_source IS NULL AND department_snapshot_captured_at IS NULL`);
      console.log(`${result.rows[0].count} legacy claims are eligible. No data changed.`);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Avoid printing connection URLs or database record contents.
    console.error(error instanceof Error ? error.message : "Department snapshot backfill failed.");
    process.exitCode = 1;
  });
}
