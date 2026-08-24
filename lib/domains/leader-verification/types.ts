import type {
  HolidayType,
  LeaderVerificationStatus,
  WorkDayType,
} from "@/lib/shared/types";

export interface LeaderVerificationPayload {
  version: 1;
  claim: {
    id: string;
    revisionNo: number;
    expenseMonth: string;
    claimant: {
      employeeId: string;
      firstName: string;
      lastName: string;
      position: string | null;
      positionShort: string;
      positionLevel: string | null;
      departmentName: string;
      departmentShort: string | null;
    };
  };
  offSiteWork: {
    id: string;
    innerRefDocumentId: string | null;
    startDate: string;
    endDate: string;
    objective: string | null;
    location: string | null;
  };
  rate: number;
  dates: Array<{
    date: string;
    dayType: WorkDayType;
    holidayType: HolidayType;
    holidayName: string | null;
    weSafeCodes: string[];
    dailyRate: number;
  }>;
  countDates: number;
  amount: number;
}

export interface LeaderVerificationEntity {
  id: string;
  claimRevisionId: string;
  revisionOffSiteWorkId: string;
  status: LeaderVerificationStatus;
  leaderUserId: string | null;
  leaderEmpIdSnapshot: string | null;
  leaderFirstNameSnapshot: string;
  leaderLastNameSnapshot: string;
  leaderPositionSnapshot: string | null;
  leaderEmailSnapshot: string | null;
  expiresAt: Date;
  payloadSnapshot: LeaderVerificationPayload;
  payloadHash: string;
  confirmedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
}

export interface LeaderVerificationWithRelations extends LeaderVerificationEntity {
  expenseClaimId: string;
  revisionNo: number;
  expenseClaim: {
    id: string;
    expenseMonth: Date;
    userId: string;
    status: string;
    claimantPositionAtSubmission: string;
    claimant: {
      id: string;
      firstName: string;
      lastName: string;
      employeeId: string | null;
    };
  };
  offSiteWorkId: string;
  offSiteWork: {
    id: string;
    innerRefDocumentId: string | null;
    startDate: Date;
    endDate: Date;
    location: string | null;
    objective: string | null;
    leaderFirstName: string | null;
    leaderLastName: string | null;
    leaderPosition: string | null;
    leaderEmpId: string | null;
  };
  confirmedDates: string[];
  confirmedDayCount: number;
  amount: number;
}

export interface VerifyResult {
  verified: boolean;
  allDone: boolean;
  expenseClaimId: string;
}

export interface CreatedLeaderVerification {
  record: LeaderVerificationEntity;
  rawToken: string;
}
