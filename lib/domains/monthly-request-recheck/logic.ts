import type {
  RecheckClaimGroup,
  RecheckClaimRow,
  RecheckDateComparison,
  RecheckDatePatternSummary,
  RecheckMetrics,
} from "./types";

type MonthlyRequestStatus = NonNullable<RecheckClaimRow["monthlyRequest"]>["status"];

export interface RecheckMetricClaim {
  id: string;
  userId: string;
  status: RecheckClaimRow["status"];
  cancelled: boolean;
  verificationTotal: number;
  verificationConfirmed: number;
  pendingLeaderForScope: boolean;
  hasActiveMonthlyRequestItem: boolean;
  hasOpenSuspiciousFlag: boolean;
}

export interface PassEligibilityInput {
  status: RecheckClaimRow["status"];
  monthMatches: boolean;
  revisionMatches: boolean;
  linkedOffSiteWorkCount: number;
  confirmedOffSiteWorkCount: number;
  hasOpenSuspiciousFlag: boolean;
  hasActiveMonthlyRequestItem: boolean;
}

export interface RecheckDatePatternClaim {
  id: string;
  dates: Iterable<string>;
}

export interface RecheckDatePatternAnalysis {
  summary: RecheckDatePatternSummary;
  comparisons: Map<string, RecheckDateComparison>;
}

function normalizedDatePattern(dates: Iterable<string>): string[] {
  return [...new Set(dates)].sort((left, right) => left.localeCompare(right));
}

/**
 * Uses a strict majority pattern as a visual comparison reference. This is a
 * review cue only: it never changes claim state or opens a suspicious flag.
 */
export function analyzeRecheckDatePatterns(
  claims: RecheckDatePatternClaim[],
): RecheckDatePatternAnalysis | null {
  if (claims.length < 2) return null;

  const normalized = claims.map((claim) => {
    const dates = normalizedDatePattern(claim.dates);
    return { id: claim.id, dates, key: dates.join("|") };
  });
  const patterns = new Map<string, { dates: string[]; claimIds: string[] }>();
  for (const claim of normalized) {
    const pattern = patterns.get(claim.key);
    if (pattern) {
      pattern.claimIds.push(claim.id);
    } else {
      patterns.set(claim.key, { dates: claim.dates, claimIds: [claim.id] });
    }
  }

  const majority = [...patterns.entries()].sort((left, right) => {
    const countDifference = right[1].claimIds.length - left[1].claimIds.length;
    if (countDifference !== 0) return countDifference;
    return left[0].localeCompare(right[0]);
  })[0]?.[1];
  if (!majority || majority.claimIds.length * 2 <= claims.length) return null;

  const majoritySet = new Set(majority.dates);
  const comparisons = new Map<string, RecheckDateComparison>();
  for (const claim of normalized) {
    const claimSet = new Set(claim.dates);
    const missingMajorityDates = majority.dates.filter((date) => !claimSet.has(date));
    const extraDates = claim.dates.filter((date) => !majoritySet.has(date));
    comparisons.set(claim.id, {
      missingMajorityDates,
      extraDates,
      differsFromMajority:
        missingMajorityDates.length > 0 || extraDates.length > 0,
    });
  }

  return {
    summary: {
      comparableClaimCount: claims.length,
      majorityClaimCount: majority.claimIds.length,
      majorityDates: majority.dates,
    },
    comparisons,
  };
}

export function overlapsMonth(
  startDate: Date,
  endDate: Date,
  monthStart: Date,
  nextMonth: Date,
): boolean {
  return startDate < nextMonth && endDate >= monthStart;
}

export function classifyRecheckClaimGroup(
  status: RecheckClaimRow["status"],
  cancelled: boolean,
): RecheckClaimGroup {
  if (status === "CANCELLED" || cancelled) return "CANCELLED";
  if (status === "DRAFT") return "DRAFT";
  if (status === "REJECTED") return "REJECTED";
  return "ACTIVE";
}

export function calculateRecheckMetrics(
  participantUserIds: Iterable<string>,
  claims: RecheckMetricClaim[],
): RecheckMetrics {
  const participantIds = new Set(participantUserIds);
  const distinctClaims = [...new Map(claims.map((claim) => [claim.id, claim])).values()];
  const submitted = distinctClaims.filter(
    (claim) => claim.status !== "DRAFT" && claim.status !== "CANCELLED" && !claim.cancelled,
  );
  const submittedUserIds = new Set(
    submitted
      .map((claim) => claim.userId)
      .filter((userId) => participantIds.has(userId)),
  );
  const active = distinctClaims.filter(
    (claim) => classifyRecheckClaimGroup(claim.status, claim.cancelled) === "ACTIVE",
  );

  return {
    participantCount: participantIds.size,
    submittedPeopleCount: submittedUserIds.size,
    notSubmittedPeopleCount: [...participantIds].filter(
      (userId) => !submittedUserIds.has(userId),
    ).length,
    pendingLeaderClaimCount: active.filter(
      (claim) => claim.pendingLeaderForScope,
    ).length,
    readyForCollectionClaimCount: active.filter(
      (claim) =>
        claim.status === "READY_FOR_COLLECTION" &&
        claim.verificationTotal > 0 &&
        claim.verificationConfirmed === claim.verificationTotal &&
        !claim.hasActiveMonthlyRequestItem,
    ).length,
    collectedClaimCount: active.filter(
      (claim) => claim.hasActiveMonthlyRequestItem,
    ).length,
    rejectedClaimCount: distinctClaims.filter(
      (claim) => classifyRecheckClaimGroup(claim.status, claim.cancelled) === "REJECTED",
    ).length,
    suspiciousClaimCount: distinctClaims.filter(
      (claim) => claim.hasOpenSuspiciousFlag,
    ).length,
  };
}

export function getPassBlockedReasons(input: PassEligibilityInput): string[] {
  const reasons: string[] = [];
  if (!input.monthMatches) reasons.push("เดือนของคำขอไม่ตรงกับเดือนที่ตรวจ");
  if (!input.revisionMatches) reasons.push("คำขอมี revision ใหม่กว่าในหน้าจอ");
  if (input.status !== "READY_FOR_COLLECTION") {
    reasons.push("สถานะยังไม่พร้อมรวบรวม");
  }
  if (input.linkedOffSiteWorkCount === 0) {
    reasons.push("ไม่มีใบนำตัวอ้างอิง");
  } else if (input.confirmedOffSiteWorkCount !== input.linkedOffSiteWorkCount) {
    reasons.push(
      `หัวหน้าชุดยังยืนยันไม่ครบ ${input.linkedOffSiteWorkCount - input.confirmedOffSiteWorkCount} ใบ`,
    );
  }
  if (input.hasOpenSuspiciousFlag) {
    reasons.push("มีประเด็นน่าสงสัยที่ยังไม่ปิด");
  }
  if (input.hasActiveMonthlyRequestItem) {
    reasons.push("ถูกรวบรวมเข้า monthly request แล้ว");
  }
  return reasons;
}

export function isPassEligible(input: PassEligibilityInput): boolean {
  return getPassBlockedReasons(input).length === 0;
}

export function isRejectEligible(
  status: RecheckClaimRow["status"],
  monthlyRequestStatus: MonthlyRequestStatus | null,
): boolean {
  return (
    ["PENDING_LEADER_CONFIRMATION", "READY_FOR_COLLECTION", "COLLECTED"].includes(status) &&
    (monthlyRequestStatus === null || monthlyRequestStatus === "DRAFT")
  );
}

export function isRemoveEligible(
  status: RecheckClaimRow["status"],
  monthlyRequestStatus: MonthlyRequestStatus | null,
): boolean {
  return status === "COLLECTED" && monthlyRequestStatus === "DRAFT";
}
