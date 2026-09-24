import { Prisma } from "@/lib/generated/prisma/client";
import type { Result } from "@/lib/shared/types";
import { bangkokCurrentMonth } from "@/lib/shared/format";
import { resolveAnalyticsClaimScope } from "@/lib/domains/expense-claim-document/read-scope";
import { analyticsRepository, type AnalyticsGroup } from "./repository";
import { reportMonths } from "./query";
import { monthLabel } from "./format";
import {
  ANALYTICS_STATUSES, STATUS_LABELS, type AnalyticsClaimPage, type AnalyticsFilters,
  type AnalyticsMetric, type AnalyticsMetrics, type AnalyticsReport,
} from "./types";

export function emptyMetrics(): AnalyticsMetrics {
  const empty = (): AnalyticsMetric => ({ amount: "0.00", count: 0, missingAmountCount: 0 });
  return { total: empty(), requested: empty(), approved: empty(), inProgress: empty(), draft: empty(),
    backlog: empty(), claimantCount: 0, averagePerClaimant: null,
    legacyDepartmentCount: 0, provisionalDepartmentCount: 0 };
}

function money(value: string | null): string | null {
  return value === null ? null : new Prisma.Decimal(value).toFixed(2);
}

/** Project only aggregate fields. Never spread database facts into a public payload. */
export function serializeMetrics(group?: AnalyticsMetrics): AnalyticsMetrics {
  if (!group) return emptyMetrics();
  const metric = (m: AnalyticsMetric): AnalyticsMetric => ({ count: m.count, amount: money(m.amount), missingAmountCount: m.missingAmountCount });
  return { total: metric(group.total), requested: metric(group.requested), approved: metric(group.approved),
    inProgress: metric(group.inProgress), draft: metric(group.draft), backlog: metric(group.backlog),
    claimantCount: group.claimantCount, averagePerClaimant: money(group.averagePerClaimant),
    legacyDepartmentCount: group.legacyDepartmentCount, provisionalDepartmentCount: group.provisionalDepartmentCount };
}

export function assembleReport(
  filters: AnalyticsFilters,
  data: { groups: AnalyticsGroup[]; departmentOptions: AnalyticsReport["departmentOptions"]; generatedAt: string },
  currentMonth: string,
): AnalyticsReport {
  const groups = new Map(data.groups.map((group) => [
    `${group.kind}:${group.key ?? ""}:${group.kind === "monthStatus" ? group.status : ""}`, group,
  ]));
  const group = (kind: AnalyticsGroup["kind"], key = "", status = "") => groups.get(`${kind}:${key}:${status}`);
  const departmentNames = new Map(data.departmentOptions.map((option) => [option.id, option.name]));
  return {
    filters, generatedAt: data.generatedAt, currentMonth,
    summary: serializeMetrics(group("total")), departmentOptions: data.departmentOptions,
    months: reportMonths(filters).map((month) => ({ key: month, label: monthLabel(month), future: month > currentMonth,
      ...serializeMetrics(group("month", month)),
      statuses: Object.fromEntries(ANALYTICS_STATUSES.map((status) => [status,
        serializeMetrics(group("monthStatus", month, status)).total,
      ])) as AnalyticsReport["months"][number]["statuses"],
    })),
    departments: data.groups.filter((g) => g.kind === "department").map((g) => ({
      key: g.key!, label: departmentNames.get(g.key!) ?? g.label ?? "ไม่ระบุแผนก",
      ...serializeMetrics(g),
    })),
    statuses: filters.statuses.map((status) => ({ key: status, label: STATUS_LABELS[status], ...serializeMetrics(group("status", status)) })),
  };
}

export const analyticsService = {
  async getReport(filters: AnalyticsFilters, now = new Date()): Promise<Result<AnalyticsReport>> {
    try {
      const currentMonth = bangkokCurrentMonth(now);
      const data = await analyticsRepository.report(filters, currentMonth);
      return { success: true, data: assembleReport(filters, data, currentMonth) };
    } catch (error) {
      console.error("[analytics] Report read failed", error instanceof Error ? error.message : "Unknown error");
      return { success: false, code: "ANALYTICS_READ_FAILED", error: "โหลดรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
    }
  },

  async getClaims(userId: string, filters: AnalyticsFilters, page: number): Promise<Result<AnalyticsClaimPage>> {
    try {
      const access = await resolveAnalyticsClaimScope(userId);
      if (!access.success) return { success: true, data: { items: [], total: 0, page: 1, pageSize: 20, restricted: true } };
      const result = await analyticsRepository.claims(filters, access.data.where, page);
      return { success: true, data: { total: result.total, page: result.page, pageSize: 20, restricted: false,
        items: result.items.map((claim) => ({ id: claim.id, month: claim.expenseMonth.toISOString().slice(0, 7),
          claimantName: `${claim.claimant.firstName} ${claim.claimant.lastName}`.trim(),
          departmentName: (claim.departmentSnapshotSource ? claim.departmentSnapshotName : claim.claimant.department?.name) ?? "ไม่ระบุแผนก",
          status: claim.cancelledAt ? "CANCELLED" : claim.status,
          amount: claim.amount === null ? null : claim.amount.toFixed(2) })),
      } };
    } catch {
      return { success: false, code: "ANALYTICS_CLAIMS_FAILED", error: "โหลดรายการเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
    }
  },
};
