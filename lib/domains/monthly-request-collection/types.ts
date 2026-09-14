/**
 * MonthlyRequestCollection Domain - Entity Types
 *
 * @module lib/domains/monthly-request-collection/types
 */

import type { ClaimDocumentStatus } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { MrcApprovalStage as StoredMrcApprovalStage, MrcStepStatus } from "@/lib/generated/prisma/client";

// Re-export for convenience
export type { MrcStepStatus };
export type MrcApprovalStage = "HPA_CHECK";

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface MrcApprovalStepEntity {
    id: string;
    monthlyRequestCollectionId: string;
    stage: StoredMrcApprovalStage;
    status: MrcStepStatus;
    reviewerId: string | null;
    reviewedAt: Date | null;
    reviewerNameAtApproval: string | null;
    reviewerPositionAtApproval: string | null;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date | null;
}

export interface MonthlyRequestCollectionEntity {
    id: string;
    collectorId: string;
    collectForMonth: Date;
    countDates: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    status: ClaimDocumentStatus;
    createdAt: Date;
    updatedAt: Date | null;
    cancelledAt: Date | null;
}

// ---------------------------------------------------------------------------
// With relations
// ---------------------------------------------------------------------------

export interface MrcApprovalStepWithReviewer extends MrcApprovalStepEntity {
    reviewer: {
        id: string;
        firstName: string;
        lastName: string;
        positionShort: string | null;
        positionLevel: string | null;
    } | null;
}

export interface MrcExpenseClaimSummary {
    id: string;
    expenseMonth: Date;
    userId: string;
    claimantPositionAtSubmission: string;
    countDates: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    remark: string | null;
    status: ClaimDocumentStatus;
    claimant: {
        id: string;
        firstName: string;
        lastName: string;
        employeeId: string | null;
        position: string | null;
        positionShort: string | null;
        positionLevel: string | null;
        departmentId: string | null;
        department: { shortName: string | null } | null;
    };
}

export interface MonthlyRequestCollectionWithRelations extends MonthlyRequestCollectionEntity {
    collector: {
        id: string;
        firstName: string;
        lastName: string;
        employeeId: string | null;
    };
    expenseClaims: MrcExpenseClaimSummary[];
    approvalSteps: MrcApprovalStepWithReviewer[];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateMrcInput {
    collectForMonth: Date | string;
    expenseClaimIds: string[];
}

export interface UpdateMrcInput {
    expenseClaimIds?: string[];
}

export interface ReviewMrcStepInput {
    stage: MrcApprovalStage;
    approved: boolean;
    remark?: string;
}

// ---------------------------------------------------------------------------
// Filter / pagination
// ---------------------------------------------------------------------------

export interface MrcFilterCriteria {
    search?: string;
    status?: ClaimDocumentStatus;
    collectForMonthFrom?: Date | string;
    collectForMonthTo?: Date | string;
    collectorId?: string;
    page?: number;
    pageSize?: number;
}

// ---------------------------------------------------------------------------
// Eligible expense claims (for admin to pick)
// ---------------------------------------------------------------------------

export interface EligibleExpenseClaimForCollection {
    id: string;
    expenseMonth: Date;
    userId: string;
    claimantPositionAtSubmission: string;
    countDates: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    remark: string | null;
    status: ClaimDocumentStatus;
    isVerified: boolean;
    claimant: {
        id: string;
        firstName: string;
        lastName: string;
        employeeId: string | null;
        position: string | null;
        positionShort: string | null;
        positionLevel: string | null;
    };
}

/** Binary signature data is only selected for authorized summary printing. */
export interface MrcSummaryPrintData extends MonthlyRequestCollectionWithRelations {
    approvalSteps: Array<MrcApprovalStepWithReviewer & { signatureData: Uint8Array | null }>;
}
