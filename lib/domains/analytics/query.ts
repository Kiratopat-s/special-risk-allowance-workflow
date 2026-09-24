import { bangkokCurrentMonth } from "@/lib/shared/format";
import type { Result } from "@/lib/shared/types";
import {
  ANALYTICS_STATUSES, type AnalyticsCalendar, type AnalyticsFilters,
  type AnalyticsInterval, type AnalyticsSort, type AnalyticsView,
} from "./types";

const intervals: AnalyticsInterval[] = ["month", "range", "quarter", "half", "year"];
const calendars: AnalyticsCalendar[] = ["calendar", "fiscal"];
const validMonth = (value: string) => /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function reportMonths(filters: Pick<AnalyticsFilters, "fromMonth" | "toMonth">): string[] {
  const months: string[] = [];
  for (let month = filters.fromMonth; month <= filters.toMonth; month = shiftMonth(month, 1)) months.push(month);
  return months;
}

/** Public query input is always revalidated on the server, including exports. */
export function parseAnalyticsQuery(query: URLSearchParams, now = new Date()): Result<AnalyticsFilters> {
  const invalid = (): Result<AnalyticsFilters> => ({
    success: false, code: "INVALID_ANALYTICS_FILTERS",
    error: "ตัวกรองไม่ถูกต้อง กรุณาเลือกช่วงเดือน ปี แผนก และสถานะใหม่",
  });
  const current = bangkokCurrentMonth(now);
  const interval = (query.get("interval") ?? "year") as AnalyticsInterval;
  const calendar = (query.get("calendar") ?? "calendar") as AnalyticsCalendar;
  const defaultYear = Number(current.slice(0, 4)) + (calendar === "fiscal" && Number(current.slice(5)) >= 10 ? 1 : 0);
  const year = Number(query.get("year") ?? defaultYear);
  const period = Number(query.get("period") ?? 1);
  if (!intervals.includes(interval) || !calendars.includes(calendar) ||
      !Number.isInteger(year) || year < 1901 || year > 2199 ||
      !Number.isInteger(period) || period < 1 || period > (interval === "quarter" ? 4 : interval === "half" ? 2 : 1)) return invalid();

  let fromMonth: string;
  let toMonth: string;
  if (interval === "month" || interval === "range") {
    fromMonth = query.get("from") ?? current;
    toMonth = interval === "month" ? fromMonth : query.get("to") ?? current;
  } else {
    const yearStart = calendar === "fiscal" ? `${year - 1}-10` : `${year}-01`;
    const size = interval === "quarter" ? 3 : interval === "half" ? 6 : 12;
    fromMonth = shiftMonth(yearStart, (period - 1) * size);
    toMonth = shiftMonth(fromMonth, size - 1);
  }
  if (!validMonth(fromMonth) || !validMonth(toMonth) || fromMonth > toMonth) return invalid();
  const values = (key: string) => [...new Set(query.getAll(key).flatMap((v) => v.split(",")).filter(Boolean))];
  const departmentIds = values("departments");
  // Department IDs are UUIDs; the sentinel explicitly selects an unassigned department.
  if (departmentIds.some((id) => id !== "unassigned" && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))) return invalid();
  const statuses = values("statuses");
  if (statuses.some((status) => !ANALYTICS_STATUSES.includes(status as typeof ANALYTICS_STATUSES[number]))) return invalid();
  return { success: true, data: {
    interval, calendar, year, period, fromMonth, toMonth, departmentIds,
    statuses: statuses.length ? statuses as typeof ANALYTICS_STATUSES : [...ANALYTICS_STATUSES],
  } };
}

export function analyticsQuery(filters: AnalyticsFilters): URLSearchParams {
  const query = new URLSearchParams({ interval: filters.interval, calendar: filters.calendar,
    year: String(filters.year), period: String(filters.period), from: filters.fromMonth, to: filters.toMonth });
  if (filters.departmentIds.length) query.set("departments", filters.departmentIds.join(","));
  if (filters.statuses.length !== ANALYTICS_STATUSES.length) query.set("statuses", filters.statuses.join(","));
  return query;
}

export function analyticsView(value: string | null): AnalyticsView {
  return value === "department" || value === "status" ? value : "month";
}
export function analyticsSort(value: string | null): AnalyticsSort {
  return value === "requested-desc" || value === "requested-asc" || value === "count-desc" ? value : "label";
}

export function analyticsPage(value: unknown): number {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1;
}
