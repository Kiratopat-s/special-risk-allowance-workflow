import { describe, expect, test } from "bun:test";
import {
  analyzeRecheckDatePatterns,
  calculateRecheckMetrics,
  classifyRecheckClaimGroup,
  getPassBlockedReasons,
  isPassEligible,
  isRejectEligible,
  isRemoveEligible,
  overlapsMonth,
  type RecheckMetricClaim,
} from "./logic";

const monthStart = new Date("2026-08-01T00:00:00.000Z");
const nextMonth = new Date("2026-09-01T00:00:00.000Z");

function claim(overrides: Partial<RecheckMetricClaim> = {}): RecheckMetricClaim {
  return {
    id: "claim-1",
    userId: "user-1",
    status: "READY_FOR_COLLECTION",
    cancelled: false,
    verificationTotal: 1,
    verificationConfirmed: 1,
    pendingLeaderForScope: false,
    hasActiveMonthlyRequestItem: false,
    hasOpenSuspiciousFlag: false,
    ...overrides,
  };
}

describe("month overlap", () => {
  test("includes records touching either edge inside the month", () => {
    expect(
      overlapsMonth(
        new Date("2026-07-20T00:00:00.000Z"),
        monthStart,
        monthStart,
        nextMonth,
      ),
    ).toBe(true);
    expect(
      overlapsMonth(
        new Date("2026-08-31T00:00:00.000Z"),
        new Date("2026-09-03T00:00:00.000Z"),
        monthStart,
        nextMonth,
      ),
    ).toBe(true);
  });

  test("excludes records wholly outside and a record starting at next-month boundary", () => {
    expect(
      overlapsMonth(
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-31T00:00:00.000Z"),
        monthStart,
        nextMonth,
      ),
    ).toBe(false);
    expect(overlapsMonth(nextMonth, nextMonth, monthStart, nextMonth)).toBe(false);
  });
});

describe("metric set semantics", () => {
  test("deduplicates participants, people and claims instead of summing OSW rows", () => {
    const ready = claim();
    const values = calculateRecheckMetrics(
      ["user-1", "user-1", "user-2", "user-3"],
      [
        ready,
        ready,
        claim({
          id: "claim-2",
          userId: "user-2",
          status: "REJECTED",
          hasOpenSuspiciousFlag: true,
        }),
        claim({
          id: "claim-3",
          userId: "user-3",
          status: "DRAFT",
        }),
        claim({ id: "claim-outsider", userId: "user-outside" }),
      ],
    );

    expect(values).toEqual({
      participantCount: 3,
      submittedPeopleCount: 2,
      notSubmittedPeopleCount: 1,
      pendingLeaderClaimCount: 0,
      readyForCollectionClaimCount: 2,
      collectedClaimCount: 0,
      rejectedClaimCount: 1,
      suspiciousClaimCount: 1,
    });
  });

  test("uses active MRC membership as collected source of truth", () => {
    const values = calculateRecheckMetrics(
      ["user-1", "user-2"],
      [
        claim({ hasActiveMonthlyRequestItem: true, status: "COLLECTED" }),
        claim({
          id: "claim-2",
          userId: "user-2",
          status: "PENDING_LEADER_CONFIRMATION",
          verificationConfirmed: 0,
          pendingLeaderForScope: true,
        }),
      ],
    );
    expect(values.collectedClaimCount).toBe(1);
    expect(values.readyForCollectionClaimCount).toBe(0);
    expect(values.pendingLeaderClaimCount).toBe(1);
  });

  test("accepts OSW-scoped pending state while keeping ready dependent on every verification", () => {
    const partiallyVerified = claim({
      verificationTotal: 2,
      verificationConfirmed: 1,
      pendingLeaderForScope: false,
    });
    const cardA = calculateRecheckMetrics(["user-1"], [partiallyVerified]);
    const cardB = calculateRecheckMetrics(
      ["user-1"],
      [{ ...partiallyVerified, pendingLeaderForScope: true }],
    );

    expect(cardA.pendingLeaderClaimCount).toBe(0);
    expect(cardB.pendingLeaderClaimCount).toBe(1);
    expect(cardA.readyForCollectionClaimCount).toBe(0);
    expect(cardB.readyForCollectionClaimCount).toBe(0);
  });
});

describe("date-pattern comparison cues", () => {
  test("uses only a strict majority and reports missing and extra dates", () => {
    const analysis = analyzeRecheckDatePatterns([
      { id: "claim-1", dates: ["2026-08-01", "2026-08-02", "2026-08-03"] },
      { id: "claim-2", dates: ["2026-08-03", "2026-08-02", "2026-08-01"] },
      { id: "claim-3", dates: ["2026-08-01", "2026-08-02", "2026-08-03"] },
      { id: "claim-outlier", dates: ["2026-08-01", "2026-08-04"] },
    ]);

    expect(analysis?.summary).toEqual({
      comparableClaimCount: 4,
      majorityClaimCount: 3,
      majorityDates: ["2026-08-01", "2026-08-02", "2026-08-03"],
    });
    expect(analysis?.comparisons.get("claim-outlier")).toEqual({
      missingMajorityDates: ["2026-08-02", "2026-08-03"],
      extraDates: ["2026-08-04"],
      differsFromMajority: true,
    });
  });

  test("does not invent a reference pattern when there is no strict majority", () => {
    expect(
      analyzeRecheckDatePatterns([
        { id: "claim-1", dates: ["2026-08-01"] },
        { id: "claim-2", dates: ["2026-08-02"] },
      ]),
    ).toBeNull();
  });
});

describe("claim grouping and pass eligibility", () => {
  test("cancelled marker wins over other status grouping", () => {
    expect(classifyRecheckClaimGroup("REJECTED", true)).toBe("CANCELLED");
    expect(classifyRecheckClaimGroup("REJECTED", false)).toBe("REJECTED");
    expect(classifyRecheckClaimGroup("DRAFT", false)).toBe("DRAFT");
  });

  test("allows only month-matched, fully verified, unflagged and uncollected ready claims", () => {
    const eligible = {
      status: "READY_FOR_COLLECTION" as const,
      monthMatches: true,
      revisionMatches: true,
      linkedOffSiteWorkCount: 2,
      confirmedOffSiteWorkCount: 2,
      hasOpenSuspiciousFlag: false,
      hasActiveMonthlyRequestItem: false,
    };
    expect(isPassEligible(eligible)).toBe(true);
    expect(
      getPassBlockedReasons({
        ...eligible,
        monthMatches: false,
        revisionMatches: false,
        confirmedOffSiteWorkCount: 1,
        hasOpenSuspiciousFlag: true,
      }),
    ).toEqual([
      "เดือนของคำขอไม่ตรงกับเดือนที่ตรวจ",
      "คำขอมี revision ใหม่กว่าในหน้าจอ",
      "หัวหน้าชุดยังยืนยันไม่ครบ 1 ใบ",
      "มีประเด็นน่าสงสัยที่ยังไม่ปิด",
    ]);
  });

  test("rejects only submitted workflow states outside finalized collections", () => {
    expect(isRejectEligible("READY_FOR_COLLECTION", null)).toBe(true);
    expect(isRejectEligible("COLLECTED", "DRAFT")).toBe(true);
    expect(isRejectEligible("COLLECTED", "FINALIZED")).toBe(false);
    expect(isRejectEligible("DRAFT", null)).toBe(false);
  });

  test("removes only collected claims from a draft collection", () => {
    expect(isRemoveEligible("COLLECTED", "DRAFT")).toBe(true);
    expect(isRemoveEligible("READY_FOR_COLLECTION", "DRAFT")).toBe(false);
    expect(isRemoveEligible("COLLECTED", "ALL_DONE")).toBe(false);
  });
});
