import type { EligibleOffSiteWorkOption } from "@/lib/domains/expense-claim-document/types";
import { thaiDateFormat } from "@/lib/shared/format";

function claimMonthValue(expenseMonth: Date | string): string | null {
  if (!(expenseMonth instanceof Date) && typeof expenseMonth !== "string") return null;
  if (typeof expenseMonth === "string" && /^\d{4}-\d{2}$/.test(expenseMonth)) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(expenseMonth) ? expenseMonth : null;
  }
  const date = new Date(expenseMonth);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 7);
}

function validClaimDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Use only saved, valid dates in the claim month; never infer dates from work ranges. */
export function normalizeClaimDates(
  expenseMonth: Date | string,
  selectedDates: unknown,
  countDates?: number | null,
): { dates: string[]; warnings: string[] } {
  const month = claimMonthValue(expenseMonth);
  if (!month) return { dates: [], warnings: ["ไม่สามารถระบุเดือนที่เบิกได้"] };

  const warnings: string[] = [];
  const values: unknown[] = Array.isArray(selectedDates) ? selectedDates : [];
  if (selectedDates == null || (Array.isArray(selectedDates) && values.length === 0)) {
    warnings.push("ยังไม่มีข้อมูลวันที่เบิกที่บันทึกไว้");
  } else if (!Array.isArray(selectedDates)) {
    warnings.push("รูปแบบข้อมูลวันที่เบิกไม่ถูกต้อง");
  }
  const validDates = values.filter((value): value is string => validClaimDate(value) && value.startsWith(`${month}-`));
  if (validDates.length !== values.length) {
    warnings.push("มีวันที่ไม่ถูกต้องหรืออยู่นอกเดือนที่เบิก จึงไม่แสดงวันที่เหล่านั้นในปฏิทิน");
  }
  const dates = [...new Set(validDates)].sort();
  if (validDates.length !== dates.length) warnings.push("พบวันที่เบิกซ้ำ จึงแสดงแต่ละวันเพียงครั้งเดียว");
  if (typeof countDates === "number" && Number.isFinite(countDates) && countDates !== dates.length) {
    warnings.push(`วันที่ที่บันทึกไว้ ${dates.length} วัน ไม่ตรงกับจำนวนที่ขอเบิก ${countDates} วัน`);
  }
  return { dates, warnings };
}

/** Compact Thai ranges, e.g. "1–3, 5, 7–9 ก.ย. 2569". */
export function formatClaimDateRanges(dates: string[]): string {
  const sorted = [...new Set(dates.filter(validClaimDate))].sort();
  const months = new Map<string, string[]>();
  for (const date of sorted) {
    const month = date.slice(0, 7);
    const items = months.get(month) ?? [];
    items.push(date);
    months.set(month, items);
  }
  return [...months.values()].map((items) => {
    const ranges: string[] = [];
    let start = items[0];
    let end = start;
    const appendRange = () => ranges.push(start === end ? String(Number(start.slice(8))) : `${Number(start.slice(8))}–${Number(end.slice(8))}`);
    for (const date of items.slice(1)) {
      if (Date.parse(date) - Date.parse(end) === 86_400_000) {
        end = date;
      } else {
        appendRange();
        start = end = date;
      }
    }
    appendRange();
    return `${ranges.join(", ")} ${thaiDateFormat(items[0], { month: "short", year: "numeric" })}`;
  }).join("; ");
}

function getMonthDateRange(monthValue: string): { start: Date; end: Date } {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getClaimDatePool(
  selectedOffSiteIds: string[],
  options: EligibleOffSiteWorkOption[],
  monthValue: string,
): { allDates: string[]; weekdayDefaultDates: string[] } {
  const picked = new Set(selectedOffSiteIds);
  const selectedRanges = options.filter((item) => picked.has(item.id));
  const { start: monthStart, end: monthEnd } = getMonthDateRange(monthValue);

  const allDates = new Set<string>();
  const weekdayDefaultDates = new Set<string>();

  for (const item of selectedRanges) {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);

    const effectiveStart = start > monthStart ? start : monthStart;
    const effectiveEnd = end < monthEnd ? end : monthEnd;

    const cursor = new Date(effectiveStart);
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor <= effectiveEnd) {
      const day = cursor.getUTCDay();
      const isoDate = toISODate(cursor);
      allDates.add(isoDate);
      if (day >= 1 && day <= 5) {
        weekdayDefaultDates.add(isoDate);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return {
    allDates: Array.from(allDates).sort(),
    weekdayDefaultDates: Array.from(weekdayDefaultDates).sort(),
  };
}

export function getCalendarGridDates(monthValue: string): Array<string | null> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)) return [];
  const [year, month] = monthValue.split("-").map(Number);
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingEmpty = firstDate.getUTCDay();

  const cells: Array<string | null> = [];
  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toISODate(new Date(Date.UTC(year, month - 1, day))));
  }

  const trailingEmpty = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i += 1) {
    cells.push(null);
  }

  return cells;
}
