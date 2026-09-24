import { describe, expect, it } from "vitest";
import { analyticsPage, analyticsQuery, parseAnalyticsQuery, reportMonths, shiftMonth } from "./query";

const now = new Date("2026-09-24T00:00:00Z");
function parse(query: string) {
  const result = parseAnalyticsQuery(new URLSearchParams(query), now);
  if (!result.success) throw new Error(result.error);
  return result.data;
}

describe("analytics period/filter contract", () => {
  it("defaults to the current Thai calendar year, all statuses and departments", () => {
    expect(parse("")).toMatchObject({ interval: "year", calendar: "calendar", fromMonth: "2026-01", toMonth: "2026-12", departmentIds: [] });
    expect(parse("").statuses).toHaveLength(8);
    expect(parseAnalyticsQuery(new URLSearchParams(), new Date("2026-12-31T17:01:00Z"))).toMatchObject({ success: true, data: { year: 2027 } });
  });
  it.each([
    ["interval=quarter&year=2026&period=1", "2026-01", "2026-03"],
    ["interval=quarter&year=2026&period=4", "2026-10", "2026-12"],
    ["interval=quarter&calendar=fiscal&year=2027&period=1", "2026-10", "2026-12"],
    ["interval=half&calendar=fiscal&year=2027&period=1", "2026-10", "2027-03"],
    ["interval=half&calendar=fiscal&year=2027&period=2", "2027-04", "2027-09"],
    ["interval=year&calendar=fiscal&year=2027", "2026-10", "2027-09"],
    ["interval=month&from=2024-02", "2024-02", "2024-02"],
    ["interval=range&from=2025-12&to=2026-02", "2025-12", "2026-02"],
  ])("normalizes %s", (query, fromMonth, toMonth) => {
    expect(parse(query)).toMatchObject({ fromMonth, toMonth });
  });
  it.each(["interval=wrong", "calendar=wrong", "year=2569", "year=Infinity", "period=0", "interval=half&period=3",
    "interval=range&from=2026-12&to=2026-01", "interval=month&from=2026-13", "statuses=PAID", "departments=bad' OR 1=1"])
  ("rejects invalid public input %s", (query) => {
    expect(parseAnalyticsQuery(new URLSearchParams(query), now)).toMatchObject({ success: false, code: "INVALID_ANALYTICS_FILTERS" });
  });
  it("round trips selection, deduplicates repeated filters and includes unknown department", () => {
    const filters = parse("interval=range&from=2026-01&to=2026-05&statuses=APPROVED,DRAFT&statuses=DRAFT&departments=unassigned,0199655d-26af-7000-9000-000000000001");
    expect(parse(analyticsQuery(filters).toString())).toEqual(filters);
    expect(filters.statuses).toEqual(["APPROVED", "DRAFT"]);
  });
  it("fills leap-month and year rollover buckets exactly once", () => {
    expect(reportMonths({ fromMonth: "2023-12", toMonth: "2024-03" })).toEqual(["2023-12", "2024-01", "2024-02", "2024-03"]);
    expect(shiftMonth("2024-02", 1)).toBe("2024-03");
    expect(analyticsPage(-3)).toBe(1);
    expect(analyticsPage(1.5)).toBe(1);
  });
});
