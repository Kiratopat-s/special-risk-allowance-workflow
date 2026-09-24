import { thaiDateFormat } from "@/lib/shared/format";
import type { AnalyticsFilters, AnalyticsRow, AnalyticsSort } from "./types";

/** Values arrive already rounded to two decimal places by Decimal on the server. */
export function formatMoney(value: string | null): string {
  if (value === null) return "ไม่ระบุ";
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
}

export function monthLabel(month: string): string {
  return thaiDateFormat(`${month}-01T00:00:00Z`, { month: "short", year: "numeric" });
}

export function reportPeriodLabel(filters: AnalyticsFilters): string {
  const range = filters.fromMonth === filters.toMonth ? monthLabel(filters.fromMonth)
    : `${monthLabel(filters.fromMonth)} – ${monthLabel(filters.toMonth)}`;
  const calendar = filters.calendar === "fiscal" ? "ปีงบประมาณ" : "ปีปฏิทิน";
  const prefix = filters.interval === "quarter" ? `ไตรมาส ${filters.period} · `
    : filters.interval === "half" ? `ครึ่งปี ${filters.period} · ` : "";
  return `${prefix}${range} · ${calendar}`;
}

function compareMoney(left: string | null, right: string | null): number {
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  const precision = Math.max(left.split(".")[1]?.length ?? 0, right.split(".")[1]?.length ?? 0);
  const integer = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(`${whole}${fraction.padEnd(precision, "0")}`);
  };
  const a = integer(left), b = integer(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

export function sortedRows<T extends AnalyticsRow>(rows: T[], sort: AnalyticsSort): T[] {
  return [...rows].sort((a, b) => {
    if (sort === "count-desc") return b.total.count - a.total.count || a.key.localeCompare(b.key);
    if (sort === "requested-asc" || sort === "requested-desc") {
      if (a.requested.amount === null || b.requested.amount === null) return compareMoney(a.requested.amount, b.requested.amount);
      return compareMoney(a.requested.amount, b.requested.amount) * (sort === "requested-desc" ? -1 : 1) || a.key.localeCompare(b.key);
    }
    return /^\d{4}-\d{2}$/.test(a.key) ? a.key.localeCompare(b.key) : a.label.localeCompare(b.label, "th");
  });
}
