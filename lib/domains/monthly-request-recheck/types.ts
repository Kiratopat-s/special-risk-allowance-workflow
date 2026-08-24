export type RecheckClaimGroup = "ACTIVE" | "REJECTED" | "DRAFT" | "CANCELLED";

export interface RecheckDepartmentOption {
  id: string;
  name: string;
  shortName: string | null;
}

export interface RecheckDay {
  isoDate: string;
  dayNumber: number;
  shortName: string;
  isWeekend: boolean;
}

export interface RecheckMetrics {
  participantCount: number;
  submittedPeopleCount: number;
  notSubmittedPeopleCount: number;
  pendingLeaderClaimCount: number;
  readyForCollectionClaimCount: number;
  collectedClaimCount: number;
  rejectedClaimCount: number;
  suspiciousClaimCount: number;
}

export interface RecheckOffSiteWorkOverview {
  id: string;
  referenceNo: string;
  startDate: string;
  endDate: string;
  objective: string | null;
  location: string | null;
  archived: boolean;
  participantCount: number;
  comparisonCueCount: number;
  metrics: RecheckMetrics;
}

export interface MonthlyRequestRecheckOverview {
  month: string;
  departmentId: string | null;
  departments: RecheckDepartmentOption[];
  totals: RecheckMetrics;
  offSiteWorks: RecheckOffSiteWorkOverview[];
}

export interface RecheckVerificationSummary {
  total: number;
  confirmed: number;
  pending: number;
}

export interface RecheckReviewFlag {
  id: string;
  status: "OPEN" | "RESOLVED";
  note: string;
  openedByName: string;
  openedAt: string;
  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
}

export interface RecheckClaimDate {
  isoDate: string;
  dayType: "DUTY" | "TRAVEL";
  holidayType: "WORKDAY" | "WEEKEND" | "PUBLIC_HOLIDAY" | "FALLBACK_WORKDAY";
  holidayName: string | null;
  requiresWeSafe: boolean;
  hasWeSafeCode: boolean;
  weSafeCodes: string[];
  offSiteWorkId: string;
  offSiteWorkReferenceNo: string;
}

export interface RecheckDatePatternSummary {
  comparableClaimCount: number;
  majorityClaimCount: number;
  majorityDates: string[];
}

export interface RecheckDateComparison {
  missingMajorityDates: string[];
  extraDates: string[];
  differsFromMajority: boolean;
}

export interface RecheckClaimRow {
  id: string;
  group: RecheckClaimGroup;
  status:
    | "DRAFT"
    | "PENDING_LEADER_CONFIRMATION"
    | "READY_FOR_COLLECTION"
    | "COLLECTED"
    | "COMPLETED"
    | "REJECTED"
    | "CANCELLED";
  employeeId: string;
  firstName: string;
  lastName: string;
  positionShort: string;
  positionLevel: string | null;
  departmentName: string;
  totalDays: number;
  totalAmount: string;
  remark: string | null;
  rejectionReason: string | null;
  revisionNo: number;
  linkedOffSiteWorkCount: number;
  linkedOffSiteWorks: Array<{
    id: string;
    referenceNo: string;
    verificationStatus: "PENDING" | "CONFIRMED" | "SUPERSEDED" | null;
  }>;
  verification: RecheckVerificationSummary;
  dates: RecheckClaimDate[];
  allDates: RecheckClaimDate[];
  dateComparison: RecheckDateComparison | null;
  duplicateWeSafeDates: string[];
  openFlags: RecheckReviewFlag[];
  resolvedFlags: RecheckReviewFlag[];
  monthlyRequest: {
    id: string;
    batchNo: number | null;
    status: "DRAFT" | "FINALIZED" | "ALL_DONE" | "CANCELLED" | "VOIDED";
  } | null;
  canPass: boolean;
  passBlockedReasons: string[];
  canReject: boolean;
  canRemove: boolean;
}

export interface MonthlyRequestRecheckDetail {
  month: string;
  days: RecheckDay[];
  datePatternSummary: RecheckDatePatternSummary | null;
  offSiteWork: {
    id: string;
    referenceNo: string;
    startDate: string;
    endDate: string;
    objective: string | null;
    location: string | null;
    archived: boolean;
    participantCount: number;
    participantNames: string[];
  };
  metrics: RecheckMetrics;
  claims: RecheckClaimRow[];
}

export interface RecheckMutationResult {
  claimId: string;
  monthlyRequestId?: string;
  batchNo?: number | null;
}

export interface RejectClaimInput {
  claimId: string;
  reason: string;
  month: string;
}

export interface FlagClaimInput {
  claimId: string;
  note: string;
  month: string;
}

export interface ResolveClaimFlagInput {
  flagId: string;
  resolutionNote: string;
  month: string;
}

export interface RemoveCollectedClaimInput {
  claimId: string;
  reason?: string;
  month: string;
}
