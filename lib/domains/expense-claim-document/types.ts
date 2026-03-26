/**
 * ExpenseClaimDocument Domain - Entity Types
 *
 * Pure domain types for expense claim document entity
 *
 * @module lib/domains/expense-claim-document/types
 */

import type { ClaimDocumentStatus } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Core ExpenseClaim entity interface
 */
export interface ExpenseClaimDocumentEntity {
    id: string;
    expenseMonth: Date;
    userId: string;
    claimantPositionAtSubmission: string;
    selectedDates: string[] | null;
    countDates: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    remark: string | null;
    createdById: string;
    createdAt: Date;
    status: ClaimDocumentStatus;
    updatedAt: Date | null;
    cancelledAt: Date | null;
    monthlyRequestCollectionId: string | null;
    collectedAt: Date | null;
}

/**
 * Expense claim with selected relations
 */
export interface ExpenseClaimDocumentWithRelations
    extends ExpenseClaimDocumentEntity {
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
        };
    }>;
}

/**
 * Data required to create a claim document
 */
export interface CreateExpenseClaimDocumentInput {
    expenseMonth: Date | string;
    userId?: string;
    claimantPositionAtSubmission: string;
    selectedDates?: string[];
    countDates?: number | string | Prisma.Decimal;
    amount?: number | string | Prisma.Decimal;
    remark?: string;
    status?: ClaimDocumentStatus;
    monthlyRequestCollectionId?: string;
    collectedAt?: Date | string;
    offSiteWorkIds?: string[];
}

/**
 * Data required to update a claim document
 */
export interface UpdateExpenseClaimDocumentInput {
    expenseMonth?: Date | string;
    claimantPositionAtSubmission?: string;
    selectedDates?: string[] | null;
    countDates?: number | string | Prisma.Decimal | null;
    amount?: number | string | Prisma.Decimal | null;
    remark?: string | null;
    status?: ClaimDocumentStatus;
    monthlyRequestCollectionId?: string | null;
    collectedAt?: Date | string | null;
    offSiteWorkIds?: string[];
}

/**
 * Filter criteria for listing claim documents
 */
export interface ExpenseClaimDocumentFilterCriteria {
    search?: string;
    userId?: string;
    createdById?: string;
    status?: ClaimDocumentStatus;
    expenseMonthFrom?: Date | string;
    expenseMonthTo?: Date | string;
    includeCancelled?: boolean;
    page?: number;
    pageSize?: number;
}

/**
 * Off-site work option eligible for creating claim documents
 */
export interface EligibleOffSiteWorkOption {
    id: string;
    innerRefDocumentId: string | null;
    startDate: Date;
    endDate: Date;
    location: string | null;
    objective: string | null;
}

/**
 * Normalize selectedDates JSON field into typed array
 */
export function toSelectedDates(data: unknown): string[] | null {
    if (!data || !Array.isArray(data)) return null;
    return data.filter((item): item is string => typeof item === "string");
}

