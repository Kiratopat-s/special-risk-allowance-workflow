import type { EligibleOffSiteWorkOption } from "@/lib/domains/expense-claim-document/types";

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
