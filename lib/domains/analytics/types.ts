import type { ClaimDocumentStatus } from "@/lib/shared/types";

export const ANALYTICS_STATUSES: ClaimDocumentStatus[] = [
  "DRAFT", "PENDING", "PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION",
  "COLLECTED", "APPROVED", "REJECTED", "CANCELLED",
];
export const STATUS_LABELS: Record<ClaimDocumentStatus, string> = {
  DRAFT: "ฉบับร่าง", PENDING: "รอดำเนินการ", PENDING_LEADER_VERIFY: "รอหัวหน้าชุดยืนยัน",
  WAIT_FOR_COLLECTION: "รอรวบรวม", COLLECTED: "รวบรวมแล้ว", APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ", CANCELLED: "ยกเลิก",
};
export const UNSPECIFIED_DEPARTMENT = "unassigned";
export type AnalyticsInterval = "month" | "range" | "quarter" | "half" | "year";
export type AnalyticsCalendar = "calendar" | "fiscal";
export type AnalyticsView = "month" | "department" | "status";
export type AnalyticsSort = "label" | "requested-desc" | "requested-asc" | "count-desc";

export interface AnalyticsFilters {
  interval: AnalyticsInterval;
  calendar: AnalyticsCalendar;
  year: number;
  period: number;
  fromMonth: string;
  toMonth: string;
  departmentIds: string[];
  statuses: ClaimDocumentStatus[];
}

export interface AnalyticsMetric {
  amount: string | null;
  count: number;
  missingAmountCount: number;
}

export interface AnalyticsMetrics {
  total: AnalyticsMetric;
  requested: AnalyticsMetric;
  approved: AnalyticsMetric;
  inProgress: AnalyticsMetric;
  draft: AnalyticsMetric;
  backlog: AnalyticsMetric;
  claimantCount: number;
  averagePerClaimant: string | null;
  legacyDepartmentCount: number;
  provisionalDepartmentCount: number;
}

export interface AnalyticsRow extends AnalyticsMetrics {
  key: string;
  label: string;
}

export interface AnalyticsMonth extends AnalyticsRow {
  future: boolean;
  statuses: Record<ClaimDocumentStatus, AnalyticsMetric>;
}

export interface AnalyticsDepartmentOption { id: string; name: string }

export interface AnalyticsReport {
  filters: AnalyticsFilters;
  generatedAt: string;
  currentMonth: string;
  summary: AnalyticsMetrics;
  months: AnalyticsMonth[];
  departments: AnalyticsRow[];
  statuses: AnalyticsRow[];
  departmentOptions: AnalyticsDepartmentOption[];
}

export interface AnalyticsClaim {
  id: string;
  month: string;
  claimantName: string;
  departmentName: string;
  status: ClaimDocumentStatus;
  amount: string | null;
}
export interface AnalyticsClaimPage {
  items: AnalyticsClaim[];
  total: number;
  page: number;
  pageSize: number;
  restricted: boolean;
}
