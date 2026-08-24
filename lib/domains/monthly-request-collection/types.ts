/**
 * Monthly Request Collection domain types.
 *
 * MRCs use their own paper-first lifecycle and immutable item/date snapshots.
 */

import type {
  ExpenseClaimStatus,
  HolidayType,
  MonthlyRequestStatus,
  WorkDayType,
} from "@/lib/generated/prisma/client";

export type { MonthlyRequestStatus };

export interface MonthlyRequestCollectionEntity {
  id: string;
  departmentId: string;
  collectorId: string;
  collectForMonth: Date;
  batchNo: number | null;
  status: MonthlyRequestStatus;
  claimCount: number;
  countDates: number;
  amount: number;
  snapshotVersion: number;
  snapshotHash: string | null;
  finalizedAt: Date | null;
  finalizedById: string | null;
  paperApprovedAt: Date | null;
  allDoneNote: string | null;
  allDoneAt: Date | null;
  allDoneById: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancelReason: string | null;
  voidedAt: Date | null;
  voidedById: string | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MrcPersonSummary {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
}

export interface MonthlyRequestItemDateSnapshot {
  id: string;
  workDate: Date;
  offSiteWorkIdSnapshot: string;
  offSiteWorkRefSnapshot: string | null;
  dayType: WorkDayType;
  holidayType: HolidayType;
  holidayName: string | null;
  dailyRate: number;
  weSafeCodes: Array<{ id: string; code: string }>;
}

export interface MonthlyRequestCollectionItemSnapshot {
  id: string;
  expenseClaimId: string;
  claimRevisionId: string;
  claimRevisionNo: number;
  addedById: string;
  addedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
  rowNo: number | null;
  employeeIdSnapshot: string | null;
  firstNameSnapshot: string;
  lastNameSnapshot: string;
  positionShortSnapshot: string;
  positionLevelSnapshot: string | null;
  departmentIdSnapshot: string;
  departmentNameSnapshot: string;
  departmentShortSnapshot: string | null;
  dayCountSnapshot: number;
  amountSnapshot: number;
  remarkSnapshot: string | null;
  claimStatus: ExpenseClaimStatus;
  dates: MonthlyRequestItemDateSnapshot[];
}

export interface MrcReplacementSourceSummary {
  id: string;
  collectForMonth: Date;
  batchNo: number | null;
  status: MonthlyRequestStatus;
  voidReason: string | null;
}

export interface MonthlyRequestCollectionWithRelations
  extends MonthlyRequestCollectionEntity {
  department: {
    id: string;
    name: string;
    shortName: string | null;
  };
  collector: MrcPersonSummary;
  finalizedBy: MrcPersonSummary | null;
  allDoneBy: MrcPersonSummary | null;
  cancelledBy: MrcPersonSummary | null;
  voidedBy: MrcPersonSummary | null;
  items: MonthlyRequestCollectionItemSnapshot[];
  replacementSources: MrcReplacementSourceSummary[];
}

export interface MrcDepartmentOption {
  id: string;
  name: string;
  shortName: string | null;
}

export interface EligibleExpenseClaimForCollection {
  id: string;
  expenseMonth: Date;
  status: ExpenseClaimStatus;
  currentRevisionNo: number;
  revisionId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  positionShort: string;
  positionLevel: string | null;
  departmentId: string;
  departmentName: string;
  departmentShort: string | null;
  dayCount: number;
  amount: number;
  remark: string | null;
  workDates: Date[];
  weSafeCodeCount: number;
  isInCurrentDraft: boolean;
}

export interface CreateMrcInput {
  collectForMonth: Date | string;
  departmentId: string;
  expenseClaimIds: string[];
}

export interface UpdateMrcInput {
  expenseClaimIds: string[];
}

export interface CompleteMrcInput {
  paperApprovedAt: Date | string;
  note?: string;
}

export interface CreateMrcReplacementInput {
  voidedMrcIds: string[];
}

export interface VoidMrcResult {
  voided: MonthlyRequestCollectionEntity;
  replacementDraft: MonthlyRequestCollectionEntity;
}

export interface MrcExportAuditMetadata {
  filename: string;
  dataRowCount: number;
  datesRowCount: number;
}

export interface MrcFilterCriteria {
  search?: string;
  status?: MonthlyRequestStatus;
  departmentId?: string;
  collectForMonthFrom?: Date | string;
  collectForMonthTo?: Date | string;
  collectorId?: string;
  page?: number;
  pageSize?: number;
}
