import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { shiftMonth } from "./query";
import type { AnalyticsDepartmentOption, AnalyticsFilters, AnalyticsMetrics } from "./types";

export interface AnalyticsGroup extends AnalyticsMetrics {
  kind: "total" | "month" | "department" | "status" | "monthStatus";
  key: string | null;
  status: string | null;
  label: string | null;
}

const progress = Prisma.sql`status IN ('PENDING', 'PENDING_LEADER_VERIFY', 'WAIT_FOR_COLLECTION', 'COLLECTED')`;

/** COUNT distinguishes an empty set (zero) from claims with entirely missing money. */
function metric(condition: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`jsonb_build_object(
    'count', (COUNT(*) FILTER (WHERE ${condition}))::integer,
    'amount', CASE WHEN COUNT(*) FILTER (WHERE ${condition}) = 0 THEN '0'
      ELSE (SUM(amount) FILTER (WHERE ${condition}))::text END,
    'missingAmountCount', (COUNT(*) FILTER (WHERE ${condition} AND amount IS NULL))::integer
  )`;
}

export function analyticsFactsSql(filters: AnalyticsFilters): Prisma.Sql {
  const start = new Date(`${filters.fromMonth}-01T00:00:00Z`);
  const end = new Date(`${shiftMonth(filters.toMonth, 1)}-01T00:00:00Z`);
  return Prisma.sql`
    SELECT * FROM (
      SELECT c.id, c.user_id, c.amount, c.expense_month, c.created_at,
        CASE WHEN c.cancelled_at IS NOT NULL THEN 'CANCELLED' ELSE c.status::text END AS status,
        COALESCE(CASE WHEN c.department_snapshot_source IS NOT NULL
          THEN c.department_snapshot_id ELSE u.department_id END, 'unassigned') AS department_key,
        COALESCE(CASE WHEN c.department_snapshot_source IS NOT NULL
          THEN c.department_snapshot_name ELSE d.name END, 'ไม่ระบุแผนก') AS department_name,
        c.department_snapshot_source AS snapshot_source
      FROM expense_claims c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE c.expense_month >= ${start} AND c.expense_month < ${end}
    ) facts
    WHERE status IN (${Prisma.join(filters.statuses)})
    ${filters.departmentIds.length ? Prisma.sql`AND department_key IN (${Prisma.join(filters.departmentIds)})` : Prisma.empty}
  `;
}

export function analyticsGroupsSql(filters: AnalyticsFilters, currentMonth: string): Prisma.Sql {
  const cutoff = new Date(`${currentMonth}-01T00:00:00Z`);
  return Prisma.sql`
    WITH facts AS (${analyticsFactsSql(filters)}),
    monthly AS (SELECT *, to_char(expense_month, 'YYYY-MM') AS month FROM facts)
    SELECT
      CASE GROUPING(month, department_key, status)
        WHEN 7 THEN 'total' WHEN 3 THEN 'month' WHEN 5 THEN 'department'
        WHEN 6 THEN 'status' WHEN 2 THEN 'monthStatus' END AS kind,
      CASE GROUPING(month, department_key, status)
        WHEN 3 THEN month WHEN 5 THEN department_key WHEN 6 THEN status WHEN 2 THEN month END AS key,
      status, MAX(department_name) AS label,
      ${metric(Prisma.sql`TRUE`)} AS total,
      ${metric(Prisma.sql`status <> 'CANCELLED'`)} AS requested,
      ${metric(Prisma.sql`status = 'APPROVED'`)} AS approved,
      ${metric(progress)} AS "inProgress",
      ${metric(Prisma.sql`status = 'DRAFT'`)} AS draft,
      ${metric(Prisma.sql`${progress} AND expense_month < ${cutoff}`)} AS backlog,
      (COUNT(DISTINCT user_id) FILTER (WHERE status <> 'CANCELLED'))::integer AS "claimantCount",
      CASE WHEN COUNT(*) FILTER (WHERE status <> 'CANCELLED' AND amount IS NULL) > 0 THEN NULL
        ELSE (ROUND((SUM(amount) FILTER (WHERE status <> 'CANCELLED')) /
          NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE status <> 'CANCELLED'), 0), 2))::text
        END AS "averagePerClaimant",
      (COUNT(*) FILTER (WHERE snapshot_source = 'LEGACY_CURRENT'))::integer AS "legacyDepartmentCount",
      (COUNT(*) FILTER (WHERE snapshot_source IS NULL))::integer AS "provisionalDepartmentCount"
    FROM monthly
    GROUP BY GROUPING SETS ((), (month), (department_key), (status), (month, status))
  `;
}

/** A single snapshot supplies every chart, table, and department option. No identifiers leave this query. */
export const analyticsRepository = {
  async report(filters: AnalyticsFilters, currentMonth: string) {
    return prisma.$transaction(async (tx) => {
      const groups = await tx.$queryRaw<AnalyticsGroup[]>(analyticsGroupsSql(filters, currentMonth));
      const departmentOptions = await tx.$queryRaw<AnalyticsDepartmentOption[]>`
        WITH represented AS (
          SELECT DISTINCT ON (department_key) department_key, department_name FROM (
            SELECT COALESCE(CASE WHEN c.department_snapshot_source IS NOT NULL
                THEN c.department_snapshot_id ELSE u.department_id END, 'unassigned') AS department_key,
              COALESCE(CASE WHEN c.department_snapshot_source IS NOT NULL
                THEN c.department_snapshot_name ELSE d.name END, 'ไม่ระบุแผนก') AS department_name,
              c.created_at, c.id
            FROM expense_claims c JOIN users u ON u.id = c.user_id
            LEFT JOIN departments d ON d.id = u.department_id
          ) source ORDER BY department_key, created_at DESC, id DESC
        ), options AS (
          SELECT id, name FROM departments
          UNION ALL SELECT department_key AS id, department_name AS name FROM represented
            WHERE department_key NOT IN (SELECT id FROM departments)
          UNION ALL SELECT 'unassigned', 'ไม่ระบุแผนก'
        ) SELECT DISTINCT id, name FROM options ORDER BY name, id
      `;
      const [clock] = await tx.$queryRaw<{ at: Date }[]>`SELECT transaction_timestamp() AS at`;
      return { groups, departmentOptions, generatedAt: clock.at.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  },

  async claims(filters: AnalyticsFilters, scope: Prisma.ExpenseClaimWhereInput, page: number) {
    const where: Prisma.ExpenseClaimWhereInput = { AND: [scope, analyticsClaimsWhere(filters)] };
    return prisma.$transaction(async (tx) => {
      const total = await tx.expenseClaim.count({ where });
      const actualPage = Math.min(page, Math.max(1, Math.ceil(total / 20)));
      const items = await tx.expenseClaim.findMany({ where, take: 20, skip: (actualPage - 1) * 20,
        orderBy: [{ expenseMonth: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: { id: true, expenseMonth: true, amount: true, status: true, cancelledAt: true,
          departmentSnapshotSource: true, departmentSnapshotName: true,
          claimant: { select: { firstName: true, lastName: true, department: { select: { name: true } } } } },
      });
      return { total, items, page: actualPage };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  },
};

/** Same effective status/department rules as the aggregate SQL; caller adds a server-owned access predicate. */
export function analyticsClaimsWhere(filters: AnalyticsFilters): Prisma.ExpenseClaimWhereInput {
  const { departmentIds } = filters;
  const departmentValues = departmentIds.filter((id) => id !== "unassigned");
  const includesNull = departmentIds.includes("unassigned");
  const departmentMatch = (field: "departmentSnapshotId" | "departmentId") => ({ OR: [
    { [field]: { in: departmentValues } }, ...(includesNull ? [{ [field]: null }] : []),
  ] });
  const normalStatuses = filters.statuses.filter((status) => status !== "CANCELLED");
  return { AND: [
    { expenseMonth: { gte: new Date(`${filters.fromMonth}-01T00:00:00Z`),
      lt: new Date(`${shiftMonth(filters.toMonth, 1)}-01T00:00:00Z`) } },
    { OR: [ { status: { in: normalStatuses }, cancelledAt: null },
      ...(filters.statuses.includes("CANCELLED") ? [{ OR: [{ status: "CANCELLED" as const }, { cancelledAt: { not: null } }] }] : []),
    ] },
    ...(departmentIds.length ? [{ OR: [
      { departmentSnapshotSource: { not: null }, ...departmentMatch("departmentSnapshotId") },
      { departmentSnapshotSource: null, claimant: departmentMatch("departmentId") },
    ] }] : []),
  ] };
}
