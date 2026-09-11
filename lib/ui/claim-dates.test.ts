import { describe, it, expect } from "vitest";
import { getClaimDatePool, getCalendarGridDates } from "./claim-dates";
import type { EligibleOffSiteWorkOption } from "@/lib/domains/expense-claim-document/types";
const work = (id: string, start: string, end: string) =>
  ({
    id,
    startDate: new Date(start),
    endDate: new Date(end),
  }) as EligibleOffSiteWorkOption;
describe("claim calendar regression", () => {
  it("deduplicates overlapping work and clips both month boundaries in UTC", () => {
    const pool = getClaimDatePool(
      ["a", "b"],
      [
        work("a", "2026-08-30", "2026-09-03"),
        work("b", "2026-09-02", "2026-10-02"),
      ],
      "2026-09",
    );
    expect(pool.allDates).toHaveLength(30);
    expect(pool.allDates[0]).toBe("2026-09-01");
    expect(pool.allDates.at(-1)).toBe("2026-09-30");
    expect(new Set(pool.allDates).size).toBe(30);
    expect(pool.weekdayDefaultDates).toHaveLength(22);
  });
  it("keeps weekends available while defaulting weekdays", () => {
    expect(
      getClaimDatePool(
        ["a"],
        [work("a", "2026-09-04", "2026-09-07")],
        "2026-09",
      ),
    ).toEqual({
      allDates: ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"],
      weekdayDefaultDates: ["2026-09-04", "2026-09-07"],
    });
  });
  it("returns the all-days fallback for weekend-only work", () => {
    const pool = getClaimDatePool(
      ["a"],
      [work("a", "2026-09-05", "2026-09-06")],
      "2026-09",
    );
    expect(pool.weekdayDefaultDates).toEqual([]);
    expect(pool.allDates).toHaveLength(2);
  });
  it("ignores unselected work and empty selections", () =>
    expect(
      getClaimDatePool([], [work("a", "2026-09-01", "2026-09-30")], "2026-09"),
    ).toEqual({ allDates: [], weekdayDefaultDates: [] }));
  it("builds leap-year calendar cells with complete weeks", () => {
    const cells = getCalendarGridDates("2024-02");
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(cells.length % 7).toBe(0);
    expect(cells[4]).toBe("2024-02-01");
  });
});
