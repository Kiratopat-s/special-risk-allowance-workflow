import { describe, it, expect } from "vitest";
import { getClaimDatePool, getCalendarGridDates, normalizeClaimDates, formatClaimDateRanges, datesWithinOrder } from "./claim-dates";
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

describe("saved claim dates", () => {
  it("sorts and deduplicates saved dates while rejecting impossible and out-of-month dates", () => {
    const result = normalizeClaimDates("2026-09", ["2026-09-05", "2026-09-01", "2026-09-05", "2026-09-31", "2026-10-01", "invalid", 1], 6);
    expect(result.dates).toEqual(["2026-09-01", "2026-09-05"]);
    expect(result.warnings).toEqual([
      "มีวันที่ไม่ถูกต้องหรืออยู่นอกเดือนที่เบิก จึงไม่แสดงวันที่เหล่านั้นในปฏิทิน",
      "พบวันที่เบิกซ้ำ จึงแสดงแต่ละวันเพียงครั้งเดียว",
      "วันที่ที่บันทึกไว้ 2 วัน ไม่ตรงกับจำนวนที่ขอเบิก 6 วัน",
    ]);
  });
  it("does not infer missing dates from stored counts or malformed JSON", () => {
    expect(normalizeClaimDates(new Date("2026-09-01T00:00:00Z"), null, 2)).toEqual({ dates: [], warnings: ["ยังไม่มีข้อมูลวันที่เบิกที่บันทึกไว้", "วันที่ที่บันทึกไว้ 0 วัน ไม่ตรงกับจำนวนที่ขอเบิก 2 วัน"] });
    expect(normalizeClaimDates("2026-09", { 0: "2026-09-01" }).dates).toEqual([]);
    expect(normalizeClaimDates("2026-09", [null, "2026-09-02"]).dates).toEqual(["2026-09-02"]);
    expect(normalizeClaimDates("invalid", ["2026-09-01"]).warnings).toEqual(["ไม่สามารถระบุเดือนที่เบิกได้"]);
    expect(getCalendarGridDates("2026-13")).toEqual([]);
  });
  it("preserves selected weekends and valid leap days without warnings", () => {
    expect(normalizeClaimDates("2024-02", ["2024-02-29", "2024-02-24"], 2)).toEqual({ dates: ["2024-02-24", "2024-02-29"], warnings: [] });
    expect(normalizeClaimDates("2025-02", ["2025-02-29"], null).dates).toEqual([]);
  });
  it("formats contiguous dates as compact Thai month ranges", () => {
    expect(formatClaimDateRanges(["2026-09-05", "2026-09-03", "2026-09-01", "2026-09-02", "2026-09-05"])).toBe("1–3, 5 ก.ย. 2569");
    expect(formatClaimDateRanges(["2026-09-01", "2026-08-31", "2026-08-30", "invalid"])).toBe("30–31 ส.ค. 2569; 1 ก.ย. 2569");
    expect(formatClaimDateRanges([])).toBe("");
  });
});

describe("saved claim dates within an order", () => {
  const dates = ["2026-09-03", "2026-09-05", "2026-09-07", "2026-09-10"];

  it("includes both UTC boundaries and only the saved dates between them", () => {
    expect(datesWithinOrder(dates, {
      startDate: new Date("2026-09-05T23:00:00Z"),
      endDate: "2026-09-07T01:00:00Z",
    })).toEqual(["2026-09-05", "2026-09-07"]);
  });

  it("describes overlapping periods without allocating or changing claim dates", () => {
    expect(datesWithinOrder(dates, { startDate: "2026-09-03", endDate: "2026-09-05" })).toEqual(["2026-09-03", "2026-09-05"]);
    expect(datesWithinOrder(dates, { startDate: "2026-09-05", endDate: "2026-09-10" })).toEqual(["2026-09-05", "2026-09-07", "2026-09-10"]);
    expect(dates).toEqual(["2026-09-03", "2026-09-05", "2026-09-07", "2026-09-10"]);
  });

  it("does not invent dates when the saved dates are missing or outside the order", () => {
    expect(datesWithinOrder([], { startDate: "2026-09-01", endDate: "2026-09-30" })).toEqual([]);
    expect(datesWithinOrder(dates, { startDate: "2026-09-11", endDate: "2026-09-20" })).toEqual([]);
  });
});
