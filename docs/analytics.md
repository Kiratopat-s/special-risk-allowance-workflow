# Analytics: definitions, deployment, and verification

The authenticated `/analytics` workspace reports **expense month and current claim status**. All signed-in users may see organization-wide aggregates and export summary CSV or browser-print PDF. Individual rows are independently constrained by claim LIST and READ permissions. This feature does not record payment, reconstruct month-end historical status, or measure monthly-collection rejection events.

## Metric contract

- Requested: every non-cancelled claim, including drafts and rejected claims, matching the existing overview definition.
- Approved: `APPROVED` (approval inside SRAW, not confirmation of disbursement).
- In progress: `PENDING`, `PENDING_LEADER_VERIFY`, `WAIT_FOR_COLLECTION`, `COLLECTED`.
- Draft: `DRAFT`. Status summaries also include rejected and cancelled claims.
- Claimants: distinct claim owners among non-cancelled claims in the entire selected cohort; never add distinct counts across months or departments.
- Average: requested amount divided by distinct claimants; unavailable if any included requested amount is missing or there are no claimants.
- Backlog: in-progress claims whose expense month precedes the current Bangkok month, within the selected filters. This is not days waiting or an SLA.
- Monetary totals sum stored claim amounts once, using PostgreSQL numeric and Decimal strings. No monthly-collection totals or OSW/verification joins are added. An empty set is zero; entirely unknown amounts are null; partial sums disclose missing counts.
- A non-null cancellation timestamp is treated as `CANCELLED` in both report and browse queries, including inconsistent legacy rows.
- Every filter affects cards, charts, tables, browse rows, and exports. Requested totals still exclude cancellation when only cancelled status is selected; the all-status amount/count columns retain those records.
- Individual browse totals may be smaller than organization totals because aggregate access does not grant document access. CSV and report PDF contain summaries only.

Filters are URL-backed: `interval=month|range|quarter|half|year`, `calendar=calendar|fiscal`, Gregorian `year`, `period`, inclusive `from`/`to` months (`YYYY-MM`), comma-separated `departments` and `statuses`. `unassigned` selects missing departments. Month uses `from`; quarter/half/year derive dates from year/period. Fiscal year is named for its ending year (FY 2570 = October 2026 through September 2027). Display years are Buddhist. Views and sorting use `view=month|department|status` and `sort=label|requested-asc|requested-desc|count-desc`; `page` affects only individual rows.

The database query uses one fact row per claim and grouping sets for total, month, department, status, and month/status. All summary sections and department options share a repeatable-read transaction. Every request computes fresh data and includes its generation timestamp; a later export can reflect intervening workflow changes. All amounts in CSV are in baht. Departments are grouped by saved ID; available current names label department groups, with saved labels retained for deleted departments and individual rows.

## Department history and access

New submitted claims snapshot the claimant's department ID/name/short name and capture time with `SUBMISSION` provenance. Capture occurs in the same transaction as first submission. The scalar ID deliberately has no department foreign key; department deletion must not erase history. A captured null department remains unassigned after a later transfer. Drafts and new cancellations before submission have provisional current-department attribution.

Existing non-draft rows are backfilled once from their current claimant department with `LEGACY_CURRENT` provenance and the backfill time, not a fabricated submission date. Existing drafts remain provisional until submitted. Later transfer, renaming, verification, collection, approval, and cancellation never recapture the snapshot. User deletion still follows the application's existing cascade policy; this feature is not an accounting archive.

Document access continues to use **current** claimant departments and active, unexpired grants, independently of report attribution. Bound grants retain their assigned department, unbound DEPARTMENT grants use the actor's current department, and descendants are not implicitly granted. LIST-first/own-only READ fallback and exact-action precedence over MANAGE are preserved. The report's detailed browse additionally intersects LIST and READ. Existing claim detail and individual print entry points recheck READ before loading sensitive relations.

## Deployment

Do not run the backfill against an unverified connection. The CLI deliberately requires Node, an explicitly supplied `DATABASE_URL`, and an explicit mode; it rejects Bun because Bun automatically loads local `.env` files. It does not print URLs or claim contents.

1. Install the committed dependencies with `bun install --frozen-lockfile` and generate Prisma with `bunx prisma generate`.
2. Apply committed migrations using the deployment's verified database connection and `bunx prisma migrate deploy`. The new migration only adds nullable snapshot fields, the provenance enum, and the department/month index.
3. Deploy snapshot-aware writers and drain all old application instances. Keep report traffic closed during cutover (or use the deployment's maintenance window).
4. With `DATABASE_URL` explicitly set in the deployment environment, run `node scripts/backfill-department-snapshots.mjs --dry-run`, inspect the count, then run the same command with `--apply`.
5. Run `--dry-run` again: no eligible legacy claims should remain. The backfill is idempotent and never overwrites real submission snapshots. Verify known department/month totals and legacy provenance before opening report traffic.
6. Reopen the workspace. Summary read failures return an explicit error, not misleading zero totals. Monitor application errors tagged `[analytics]` and database query latency through existing deployment logs.

Rollback may revert application code while leaving additive columns in place. After any old writers are used again, repeat the conditional backfill before re-enabling the report. Do not drop or overwrite captured history as a rollback shortcut.

## Validation

- `bun run test` — unit/component/action regressions, including periods, permissions, CSV safety, null/decimal values, and UI interactions.
- `bun run lint` and `bunx tsc --noEmit --incremental false`.
- `bun run build` — normal production build.
- `bun scripts/test-department-snapshot-db.mjs` — disposable PostgreSQL container, all migrations, schema drift check, snapshot/concurrency/backfill tests, and real analytics SQL tests. It ignores application database URLs and destroys only its own test container.
- `bun tests/visual/serve-analytics.mjs` — populated visual fixture at localhost port 4187, isolated from application server actions and real records. Navigation updates filter labels/URLs while retaining fixed fixture aggregates; use backend tests to verify filtering arithmetic.

Acceptance examples: draft in A transferred to B before submission snapshots B; submitted in A transferred to B stays A; submitted without department remains unassigned; legacy backfill stays marked as substitute data; two OSWs do not double an amount; `0.10 + 0.20` is exactly `0.30`; one claimant across two months counts once in the total; unauthorized direct-ID or print access cannot bypass department scope.

### Implementation verification (24 September 2026)

- Full Vitest suite: 659 tests across 73 files passed; 8 tests cover the new UI flows.
- Disposable PostgreSQL: 12 integration tests passed; all 26 migrations applied, schema diff clean. No application database was changed.
- ESLint and TypeScript checks passed. Normal Turbopack build was blocked by this environment's internal port-binding restriction; `bun run build --webpack` compiled the production application successfully without changing the normal build script.
- Populated fixture reviewed at 1366px desktop and 390px mobile, including dark mode, month selection, keyboard submission, named print layout, charts, and summary-only print table. No document-wide horizontal overflow at either width and no browser console errors were observed.
- Verification limits: the fixture does not exercise a live Keycloak session or real records, and an actual saved PDF/physical-printer pagination comparison was not performed. Multi-page print rules and personal-data exclusion are covered by tests and the screen-rendered print report; final deployment acceptance should include a populated staging account and the intended browser's PDF export.
