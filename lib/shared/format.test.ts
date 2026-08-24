import { describe, expect, test } from "bun:test";

import {
  APP_TIME_ZONE,
  dateDisplay,
  moneyDisplay,
  monthDisplay,
  toDateInputValue,
  toMonthInput,
} from "./format";

describe("Thai display formatting", () => {
  test("uses Asia/Bangkok and the Buddhist era", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Bangkok");
    expect(dateDisplay("2026-01-01T20:00:00.000Z")).toBe("02/01/2569");
    expect(monthDisplay("2026-08-01T00:00:00.000Z")).toContain("2569");
  });

  test("keeps canonical HTML inputs in the Gregorian calendar", () => {
    const value = new Date("2026-08-09T00:00:00.000Z");
    expect(toMonthInput(value)).toBe("2026-08");
    expect(toDateInputValue(value)).toBe("2026-08-09");
  });

  test("formats allowance values with two decimal places", () => {
    expect(moneyDisplay(1500)).toBe("1,500.00");
    expect(moneyDisplay("not-a-number")).toBe("-");
  });
});
