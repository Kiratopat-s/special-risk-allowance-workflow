import { describe, expect, it } from "vitest";
import { formatPickerDate, parsePickerDate } from "./picker-date";

describe("picker date-only boundary", () => {
  it.each([
    "2024-02-29",
    "2026-01-01",
    "2026-12-31",
    "1899-12-31",
    "2100-01-01",
    "0001-01-01",
    "9999-12-31",
  ])("roundtrips %s at UTC midnight", (value) => {
    const parsed = parsePickerDate(value, "date");
    expect(formatPickerDate(parsed, "date")).toBe(value);
    expect(parsed?.utcOffset()).toBe(0);
    expect(parsed?.hour()).toBe(0);
  });
  it.each([
    "2026-02-29",
    "2026-04-31",
    "2026-00-12",
    "0000-01-01",
    "2026-9-1",
    "",
    "not-a-date",
  ])("rejects invalid dates without rollover: %s", (value) => {
    expect(parsePickerDate(value, "date")).toBeNull();
  });
  it("preserves the month without adding a day to its payload", () => {
    expect(formatPickerDate(parsePickerDate("2026-09", "month"), "month")).toBe(
      "2026-09",
    );
    expect(parsePickerDate("2026-13", "month")).toBeNull();
  });
});
