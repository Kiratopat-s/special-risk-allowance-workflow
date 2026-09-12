import { describe, expect, it } from "vitest";
import {
  buddhistDateParts,
  parseBuddhistDateParts,
  parseBuddhistDateText,
  stepBuddhistDatePart,
} from "./buddhist-date";

describe("Buddhist input boundary", () => {
  it.each([
    ["12/09/2569", "2026-09-12"],
    ["29/02/2567", "2024-02-29"],
    ["01/01/0544", "0001-01-01"],
    ["31/12/10542", "9999-12-31"],
    ["01/01/0642", "0099-01-01"],
    ["01/01/2026", "1483-01-01"],
  ])("roundtrips %s without guessing the era", (text, iso) => {
    const parts = parseBuddhistDateText(text, "date")!;
    expect(parseBuddhistDateParts(parts, "date")).toEqual({
      status: "valid",
      value: iso,
    });
    expect(buddhistDateParts(iso, "date")).toEqual(parts);
  });
  it("keeps a month payload free of day components", () => {
    expect(
      parseBuddhistDateParts(
        parseBuddhistDateText("09/2569", "month")!,
        "month",
      ),
    ).toEqual({ status: "valid", value: "2026-09" });
  });
  it.each([
    "29/02/2569",
    "31/04/2569",
    "01/13/2569",
    "00/01/2569",
    "01/01/0543",
    "01/01/10543",
    "29/02/2643",
  ])("rejects %s without rolling over", (text) => {
    expect(
      parseBuddhistDateParts(parseBuddhistDateText(text, "date")!, "date"),
    ).toEqual({ status: "invalid", value: "" });
  });
  it("distinguishes an empty field from an incomplete edit", () => {
    expect(
      parseBuddhistDateParts({ day: "", month: "", year: "" }, "date").status,
    ).toBe("empty");
    expect(
      parseBuddhistDateParts({ day: "12", month: "09", year: "25" }, "date")
        .status,
    ).toBe("incomplete");
    expect(
      parseBuddhistDateParts({ day: "", month: "09", year: "2569" }, "date")
        .status,
    ).toBe("incomplete");
  });
  it("uses Gregorian leap-year arithmetic when stepping years and months", () => {
    const leap = buddhistDateParts("2024-02-29", "date");
    expect(stepBuddhistDatePart(leap, "date", "year", 1)).toEqual({
      day: "28",
      month: "02",
      year: "2568",
    });
    expect(
      stepBuddhistDatePart(
        buddhistDateParts("2026-01-31", "date"),
        "date",
        "month",
        1,
      ),
    ).toEqual({ day: "28", month: "02", year: "2569" });
  });
});
