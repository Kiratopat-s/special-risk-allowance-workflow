import { describe, expect, test } from "bun:test";
import {
  parseBangkokDateTime,
  validateMrcTransition,
  validatePaperApprovalDate,
} from "./policy";

describe("MRC clean-break state machine", () => {
  test("allows only the declared lifecycle commands", () => {
    expect(validateMrcTransition("DRAFT", "FINALIZED").valid).toBe(true);
    expect(validateMrcTransition("DRAFT", "CANCELLED").valid).toBe(true);
    expect(validateMrcTransition("FINALIZED", "ALL_DONE").valid).toBe(true);
    expect(validateMrcTransition("FINALIZED", "VOIDED").valid).toBe(true);
    expect(validateMrcTransition("ALL_DONE", "VOIDED").valid).toBe(true);
    expect(validateMrcTransition("FINALIZED", "CANCELLED").valid).toBe(false);
    expect(validateMrcTransition("ALL_DONE", "DRAFT").valid).toBe(false);
    expect(validateMrcTransition("VOIDED", "FINALIZED").valid).toBe(false);
  });

  test("treats an idempotent command as valid", () => {
    expect(validateMrcTransition("FINALIZED", "FINALIZED")).toEqual({
      valid: true,
      value: "FINALIZED",
    });
  });
});

describe("paper approval time", () => {
  test("parses datetime-local as Asia/Bangkok rather than server local time", () => {
    expect(parseBangkokDateTime("2026-08-09T15:30").toISOString()).toBe(
      "2026-08-09T08:30:00.000Z",
    );
  });

  test("accepts a completed paper approval between finalization and now", () => {
    const result = validatePaperApprovalDate("2026-08-09T15:30", {
      finalizedAt: new Date("2026-08-09T08:00:00.000Z"),
      now: new Date("2026-08-09T08:31:00.000Z"),
    });
    expect(result.valid).toBe(true);
  });

  test("rejects even a same-day future time", () => {
    const result = validatePaperApprovalDate("2026-08-09T15:32", {
      now: new Date("2026-08-09T08:31:00.000Z"),
    });
    expect(result).toEqual({
      valid: false,
      code: "APPROVAL_DATE_IN_FUTURE",
      message: "Paper approval date cannot be in the future",
    });
  });

  test("rejects approval before finalization", () => {
    const result = validatePaperApprovalDate("2026-08-09T15:29", {
      finalizedAt: new Date("2026-08-09T08:30:00.000Z"),
      now: new Date("2026-08-09T09:00:00.000Z"),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("APPROVAL_DATE_BEFORE_FINALIZED");
  });

  test("rejects normalized overflow dates and invalid months", () => {
    for (const value of ["2026-02-31T10:00", "2026-13-01T10:00"]) {
      const result = validatePaperApprovalDate(value, {
        now: new Date("2026-12-31T23:59:59.000Z"),
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe("INVALID_APPROVAL_DATE");
    }
  });
});
