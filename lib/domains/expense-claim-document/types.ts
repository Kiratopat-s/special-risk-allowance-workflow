import type {
  ExpenseClaimRevisionStatus,
  ExpenseClaimStatus,
  HolidaySource,
  HolidayType,
  WorkDayType,
} from "@/lib/shared/types";

export interface ClaimWorkDateInput {
  date: string;
  offSiteWorkId: string;
  weSafeCodes?: string[];
}

export interface ClaimWorkDateView {
  id: string;
  date: string;
  offSiteWorkId: string;
  dayType: WorkDayType;
  holidayType: HolidayType;
  holidayName: string | null;
  holidaySource: HolidaySource;
  requiresWeSafe: boolean;
  dailyRate: number;
  weSafeCodes: string[];
}

export interface ClaimRevisionOffSiteWorkView {
  id: string;
  offSiteWorkId: string;
  innerRefDocumentId: string | null;
  startDate: Date;
  endDate: Date;
  objective: string | null;
  location: string | null;
  leaderUserId: string | null;
  leaderEmpId: string | null;
  leaderFirstName: string;
  leaderLastName: string;
  leaderPosition: string | null;
  leaderEmail: string | null;
}

export interface ClaimRevisionView {
  id: string;
  revisionNo: number;
  status: ExpenseClaimRevisionStatus;
  claimantPositionAtSubmission: string;
  totalDays: number;
  totalAmount: number;
  ratePerDay: number;
  remark: string | null;
  submittedAt: Date | null;
  supersededAt: Date | null;
  offSiteWorks: ClaimRevisionOffSiteWorkView[];
  workDates: ClaimWorkDateView[];
}

export interface ExpenseClaimDocumentEntity {
  id: string;
  expenseMonth: Date;
  userId: string;
  createdById: string;
  status: ExpenseClaimStatus;
  currentRevisionNo: number;
  collectedAt: Date | null;
  completedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  currentRevision: ClaimRevisionView;
  claimantPositionAtSubmission: string;
  countDates: number;
  amount: number;
  remark: string | null;
  monthlyRequestCollectionId: string | null;
}

export interface ExpenseClaimDocumentWithRelations extends ExpenseClaimDocumentEntity {
  claimant: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
    departmentId: string | null;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
  };
  expenseClaimOffSiteWorks: Array<{
    offSiteWorkId: string;
    offSiteWork: {
      id: string;
      innerRefDocumentId: string | null;
      startDate: Date;
      endDate: Date;
      location: string | null;
      objective: string | null;
      leaderUserId: string | null;
      leaderEmpId: string | null;
      leaderFirstName: string | null;
      leaderLastName: string | null;
      leaderPosition: string | null;
      leaderEmail: string | null;
    };
  }>;
  leaderVerifications: Array<{
    id: string;
    revisionNo: number;
    offSiteWorkId: string;
    leaderUserId: string | null;
    leaderEmail: string | null;
    expiresAt: Date;
    confirmedAt: Date | null;
    status: "PENDING" | "CONFIRMED" | "SUPERSEDED";
  }>;
}

export interface CreateExpenseClaimDocumentInput {
  expenseMonth: Date | string;
  userId?: string;
  remark?: string;
  workDates: ClaimWorkDateInput[];
}

export interface UpdateExpenseClaimDocumentInput {
  remark?: string | null;
  workDates: ClaimWorkDateInput[];
  expenseMonth?: Date | string;
}

export interface ExpenseClaimDocumentFilterCriteria {
  search?: string;
  userId?: string;
  createdById?: string;
  status?: ExpenseClaimStatus;
  expenseMonthFrom?: Date | string;
  expenseMonthTo?: Date | string;
  includeCancelled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface EligibleOffSiteWorkOption {
  id: string;
  supersedesId: string | null;
  innerRefDocumentId: string | null;
  startDate: Date;
  endDate: Date;
  location: string | null;
  objective: string | null;
  hasLeader: boolean;
  leaderFirstName: string | null;
  leaderLastName: string | null;
  leaderEmail: string | null;
}

export interface PreparedWorkDate {
  date: Date;
  dateIso: string;
  offSiteWorkId: string;
  dayType: WorkDayType;
  holidayType: HolidayType;
  holidayName: string | null;
  holidaySource: HolidaySource;
  requiresWeSafe: boolean;
  weSafeCodes: string[];
}

export interface ClaimantSnapshot {
  employeeId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  positionShort: string;
  positionLevel: string | null;
  departmentId: string;
  departmentName: string;
  departmentShort: string | null;
}

export interface PreparedRevision {
  claimant: ClaimantSnapshot;
  remark: string | null;
  workDates: PreparedWorkDate[];
  offSiteWorks: Array<{
    id: string;
    innerRefDocumentId: string | null;
    startDate: Date;
    endDate: Date;
    objective: string | null;
    location: string | null;
    leaderUserId: string | null;
    leaderEmpId: string | null;
    leaderFirstName: string;
    leaderLastName: string;
    leaderPosition: string | null;
    leaderEmail: string | null;
  }>;
  totalDays: number;
  totalAmount: number;
  materialHash: string;
}
