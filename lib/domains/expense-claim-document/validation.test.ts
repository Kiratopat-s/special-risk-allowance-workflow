import { describe, expect, test } from "bun:test";
import {
  calculateClaimAmount,
  deriveWorkDayType,
  isValidWeSafeCode,
  normalizeWeSafeCodes,
  requiresWeSafeCode,
} from "./validation";

describe("expense claim server validation", () => {
  test("trims We Safe codes without changing case or removing duplicates", () => {
    expect(normalizeWeSafeCodes(["  WsZ2026hz0000017489 ", "same", "same"])).toEqual([
      "WsZ2026hz0000017489",
      "same",
      "same",
    ]);
  });

  test("validates only the trimmed 19-character contract", () => {
    expect(isValidWeSafeCode(" WSZ2026HZ0000017489 ")).toBe(true);
    expect(isValidWeSafeCode("abcdefghijklmnopqrs")).toBe(true);
    expect(isValidWeSafeCode("too-short")).toBe(false);
  });

  test("derives travel days from both OSW boundaries", () => {
    expect(deriveWorkDayType("2026-08-01", "2026-08-01", "2026-08-03")).toBe("TRAVEL");
    expect(deriveWorkDayType("2026-08-03", "2026-08-01", "2026-08-03")).toBe("TRAVEL");
    expect(deriveWorkDayType("2026-08-02", "2026-08-01", "2026-08-03")).toBe("DUTY");
    expect(deriveWorkDayType("2026-08-01", "2026-08-01", "2026-08-01")).toBe("TRAVEL");
  });

  test("requires We Safe for travel, weekends and public holidays", () => {
    expect(requiresWeSafeCode("TRAVEL", "WORKDAY")).toBe(true);
    expect(requiresWeSafeCode("DUTY", "WEEKEND")).toBe(true);
    expect(requiresWeSafeCode("DUTY", "PUBLIC_HOLIDAY")).toBe(true);
    expect(requiresWeSafeCode("DUTY", "FALLBACK_WORKDAY")).toBe(false);
  });

  test("calculates the server-owned 150 baht daily amount", () => {
    expect(calculateClaimAmount(0)).toBe(0);
    expect(calculateClaimAmount(7)).toBe(1050);
    expect(() => calculateClaimAmount(-1)).toThrow();
    expect(() => calculateClaimAmount(1.5)).toThrow();
  });
});
