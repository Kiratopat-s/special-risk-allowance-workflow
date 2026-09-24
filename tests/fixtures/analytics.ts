import { ANALYTICS_STATUSES, STATUS_LABELS, type AnalyticsClaimPage, type AnalyticsMetric, type AnalyticsMetrics, type AnalyticsReport } from "@/lib/domains/analytics/types";
import { monthLabel } from "@/lib/domains/analytics/format";
import type { ClaimDocumentStatus } from "@/lib/shared/types";

const metric = (amount: number, count: number, missingAmountCount = 0): AnalyticsMetric => ({ amount: amount.toFixed(2), count, missingAmountCount });
function sum(values: AnalyticsMetric[]): AnalyticsMetric {
  return metric(values.reduce((total, value) => total + Number(value.amount), 0), values.reduce((total, value) => total + value.count, 0), values.reduce((total, value) => total + value.missingAmountCount, 0));
}
function metrics(statuses: Record<ClaimDocumentStatus, AnalyticsMetric>, claimants = 12): AnalyticsMetrics {
  const requested = sum(ANALYTICS_STATUSES.filter((status) => status !== "CANCELLED").map((status) => statuses[status]));
  const inProgress = sum([statuses.PENDING, statuses.PENDING_LEADER_VERIFY, statuses.WAIT_FOR_COLLECTION, statuses.COLLECTED]);
  return { total: sum(Object.values(statuses)), requested, approved: statuses.APPROVED,
    inProgress, draft: statuses.DRAFT, backlog: inProgress, claimantCount: requested.count ? claimants : 0,
    averagePerClaimant: requested.missingAmountCount || !requested.count ? null : (Number(requested.amount) / claimants).toFixed(2),
    legacyDepartmentCount: 0, provisionalDepartmentCount: statuses.DRAFT.count };
}
const months = Array.from({ length: 12 }, (_, index) => {
  const statuses = Object.fromEntries(ANALYTICS_STATUSES.map((status, statusIndex) => [status,
    index > 9 ? metric(0, 0) : metric((index + 1) * (statusIndex + 1) * 150.25, statusIndex + 1, index === 5 && status === "DRAFT" ? 1 : 0),
  ])) as Record<ClaimDocumentStatus, AnalyticsMetric>;
  const key = `2026-${String(index + 1).padStart(2, "0")}`;
  return { ...metrics(statuses), key, label: monthLabel(key), future: index >= 9, statuses,
    backlog: index < 8 ? metrics(statuses).inProgress : metric(0, 0) };
});
function combinedStatuses(rows: typeof months) {
  return Object.fromEntries(ANALYTICS_STATUSES.map((status) => [status, sum(rows.map((row) => row.statuses[status]))])) as Record<ClaimDocumentStatus, AnalyticsMetric>;
}
const allStatuses = combinedStatuses(months);
export const analyticsFixture: AnalyticsReport = {
  filters: { interval: "year", calendar: "calendar", year: 2026, period: 1, fromMonth: "2026-01", toMonth: "2026-12", departmentIds: [], statuses: [...ANALYTICS_STATUSES] },
  generatedAt: "2026-09-24T06:15:00.000Z", currentMonth: "2026-09",
  summary: { ...metrics(allStatuses), legacyDepartmentCount: 25, backlog: sum(months.map((month) => month.backlog)) },
  months,
  departments: [
    { ...metrics(combinedStatuses(months.slice(0, 6))), key: "00000000-0000-4000-8000-000000000001", label: "แผนกก่อสร้างและปฏิบัติการระบบไฟฟ้า" },
    { ...metrics(combinedStatuses(months.slice(6))), key: "00000000-0000-4000-8000-000000000002", label: "แผนกบริการลูกค้าและบำรุงรักษา" },
  ],
  statuses: ANALYTICS_STATUSES.map((status) => {
    const isolated = Object.fromEntries(ANALYTICS_STATUSES.map((key) => [key, key === status ? allStatuses[key] : metric(0, 0)])) as Record<ClaimDocumentStatus, AnalyticsMetric>;
    return { ...metrics(isolated), key: status, label: STATUS_LABELS[status] };
  }),
  departmentOptions: [
    { id: "00000000-0000-4000-8000-000000000001", name: "แผนกก่อสร้างและปฏิบัติการระบบไฟฟ้า" },
    { id: "00000000-0000-4000-8000-000000000002", name: "แผนกบริการลูกค้าและบำรุงรักษา" },
    { id: "00000000-0000-4000-8000-000000000003", name: "แผนกย้อนหลัง (ไม่ใช้งาน)" },
    { id: "unassigned", name: "ไม่ระบุแผนก" },
  ],
};
export const analyticsClaimsFixture: AnalyticsClaimPage = {
  total: 25, page: 1, pageSize: 20, restricted: true,
  items: [{ id: "fixture-personal-claim", claimantName: "ผู้ทดสอบ รายงาน", month: "2026-09", amount: "450.25", departmentName: "แผนกก่อสร้างและปฏิบัติการระบบไฟฟ้า", status: "APPROVED" }],
};
