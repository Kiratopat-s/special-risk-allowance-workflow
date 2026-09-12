import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bangkokCurrentMonth,
  bangkokToday,
  dateDisplay,
  dateTimeDisplay,
  longDateDisplay,
  monthDisplay,
  shortDateDisplay,
  toDateInputValue,
  toMonthInput,
} from "./format";
import { ThaiCalendarAdapter } from "@/lib/ui/thai-calendar-adapter";
import { parsePickerDate } from "@/lib/ui/picker-date";

afterEach(() => vi.useRealTimers());

describe("Thai dates and timestamps", () => {
  it("keeps a missing or malformed display value from crashing a page", () => {
    expect(monthDisplay("")).toBe("—");
    expect(dateDisplay("not-a-date")).toBe("—");
  });
  it("formats all date-only styles in Buddhist years with Latin digits", () => {
    expect(dateDisplay("2026-09-12")).toBe("12/09/2569");
    expect(monthDisplay("2026-09-01")).toBe("กันยายน 2569");
    expect(longDateDisplay("2026-09-12")).toBe("12 กันยายน 2569");
    expect(shortDateDisplay("2026-09-12")).toBe("12 ก.ย. 2569");
    expect(longDateDisplay(null, "—")).toBe("—");
  });
  it("distinguishes a date-only value from a Bangkok timestamp", () => {
    const instant = "2026-12-31T18:00:00Z";
    expect(dateDisplay(instant)).toBe("31/12/2569");
    expect(dateDisplay(instant, { timeZone: "Asia/Bangkok" })).toBe(
      "01/01/2570",
    );
    expect(dateTimeDisplay(instant)).toContain("1 มกราคม 2570");
    expect(dateTimeDisplay(instant)).toContain("01:00:00");
    expect(longDateDisplay(instant, "", { timeZone: "Asia/Bangkok" })).toBe(
      "1 มกราคม 2570",
    );
    expect(toDateInputValue(instant)).toBe("2026-12-31");
    expect(toMonthInput(instant)).toBe("2026-12");
  });
  it.each([
    ["2026-12-31T16:59:59Z", "2026-12-31", "2026-12"],
    ["2026-12-31T17:00:00Z", "2027-01-01", "2027-01"],
    ["2026-09-30T17:00:00Z", "2026-10-01", "2026-10"],
  ])("uses the Thai civil date at %s", (instant, day, month) => {
    expect(bangkokToday(new Date(instant))).toBe(day);
    expect(bangkokCurrentMonth(new Date(instant))).toBe(month);
  });
  it("keeps the calendar's today and year highlight in Thailand without shifting saved dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T18:00:00Z"));
    const adapter = new ThaiCalendarAdapter({ locale: "th" });
    const today = adapter.date(undefined, "UTC");
    expect(today.format("YYYY-MM-DD")).toBe("2027-01-01");
    expect(adapter.format(today, "year")).toBe("2570");
    expect(adapter.date(null, "UTC")).toBeNull();
    expect(
      adapter.date("2026-12-31T00:00:00Z", "UTC").format("YYYY-MM-DD"),
    ).toBe("2026-12-31");
    expect(adapter.format(parsePickerDate("9999-12-31", "date")!, "year")).toBe(
      "10542",
    );
  });
});
