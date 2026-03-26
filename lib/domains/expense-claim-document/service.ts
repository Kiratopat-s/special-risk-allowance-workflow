/**
 * ExpenseClaimDocument Domain - Service Layer
 *
 * Business logic layer for expense claim document operations
 *
 * @module lib/domains/expense-claim-document/service
 */

import { expenseClaimDocumentRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { ActionType } from "@/lib/shared/types";
import { success, error, type Result } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/shared/types";
import type {
    ExpenseClaimDocumentEntity,
    ExpenseClaimDocumentWithRelations,
    CreateExpenseClaimDocumentInput,
    UpdateExpenseClaimDocumentInput,
    ExpenseClaimDocumentFilterCriteria,
    EligibleOffSiteWorkOption,
} from "./types";

type JsonValue = Prisma.JsonValue;

interface RequestContext {
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
    requestMethod?: string;
}

function normalizeMonth(value: Date | string): Date {
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const expenseClaimDocumentService = {
    /**
     * List eligible off-site works for claim creation
     */
    async listEligibleOffSiteWorksForUser(
        userId: string,
        month: Date
    ): Promise<Result<EligibleOffSiteWorkOption[]>> {
        const options = await expenseClaimDocumentRepository.findEligibleOffSiteWorksForUser(
            userId,
            month
        );
        return success(options);
    },

    /**
     * Get claim by ID with relations
     */
    async getById(id: string): Promise<Result<ExpenseClaimDocumentWithRelations>> {
        const claim = await expenseClaimDocumentRepository.findWithRelations(id);

        if (!claim) {
            return error("Expense claim document not found", "CLAIM_NOT_FOUND");
        }

        return success(claim);
    },

    /**
     * Create a new claim document
     */
    async create(
        data: CreateExpenseClaimDocumentInput,
        actorId: string,
        targetUserId: string,
        context?: RequestContext
    ): Promise<Result<ExpenseClaimDocumentEntity>> {
        if (!data.claimantPositionAtSubmission?.trim()) {
            return error(
                "Claimant position at submission is required",
                "MISSING_CLAIMANT_POSITION"
            );
        }

        if (data.selectedDates) {
            const invalidDate = data.selectedDates.find((date) => !isIsoDate(date));
            if (invalidDate) {
                return error(
                    `Invalid selected date format: ${invalidDate}`,
                    "INVALID_SELECTED_DATES"
                );
            }
        }

        const normalizedMonth = normalizeMonth(data.expenseMonth);

        const claim = await expenseClaimDocumentRepository.create(
            {
                ...data,
                expenseMonth: normalizedMonth,
            },
            targetUserId,
            actorId
        );

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${claim.id}" created`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: claim.id,
            newData: {
                id: claim.id,
                userId: claim.userId,
                expenseMonth: claim.expenseMonth.toISOString(),
                status: claim.status,
            } as unknown as JsonValue,
            ...context,
        });

        return success(claim, "Expense claim document created successfully");
    },

    /**
     * Update an existing claim document
     */
    async update(
        id: string,
        data: UpdateExpenseClaimDocumentInput,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<ExpenseClaimDocumentEntity>> {
        const existing = await expenseClaimDocumentRepository.findById(id);

        if (!existing) {
            return error("Expense claim document not found", "CLAIM_NOT_FOUND");
        }

        if (existing.status === "CANCELLED") {
            return error(
                "Cannot edit a cancelled expense claim document",
                "CLAIM_CANCELLED"
            );
        }

        if (data.selectedDates) {
            const invalidDate = data.selectedDates.find((date) => !isIsoDate(date));
            if (invalidDate) {
                return error(
                    `Invalid selected date format: ${invalidDate}`,
                    "INVALID_SELECTED_DATES"
                );
            }
        }

        const updatePayload: UpdateExpenseClaimDocumentInput = {
            ...data,
            ...(data.expenseMonth
                ? { expenseMonth: normalizeMonth(data.expenseMonth) }
                : {}),
        };

        const updated = await expenseClaimDocumentRepository.update(id, updatePayload);

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" updated`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: id,
            previousData: {
                expenseMonth: existing.expenseMonth.toISOString(),
                status: existing.status,
                remark: existing.remark,
            } as unknown as JsonValue,
            newData: data as unknown as JsonValue,
            ...context,
        });

        return success(updated, "Expense claim document updated successfully");
    },

    /**
     * Soft-delete a claim document by cancellation
     */
    async delete(
        id: string,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<void>> {
        const existing = await expenseClaimDocumentRepository.findById(id);

        if (!existing) {
            return error("Expense claim document not found", "CLAIM_NOT_FOUND");
        }

        if (existing.status === "APPROVED") {
            return error(
                "Approved expense claim cannot be cancelled",
                "CLAIM_ALREADY_APPROVED"
            );
        }

        if (existing.status === "CANCELLED") {
            return error("Expense claim already cancelled", "CLAIM_CANCELLED");
        }

        await expenseClaimDocumentRepository.softDelete(id);

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" cancelled`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: id,
            previousData: {
                status: existing.status,
                cancelledAt: existing.cancelledAt,
            } as unknown as JsonValue,
            ...context,
        });

        return success(undefined, "Expense claim document cancelled successfully");
    },

    /**
     * List claim documents with filters
     */
    async list(
        criteria: ExpenseClaimDocumentFilterCriteria
    ): Promise<Result<PaginatedResult<ExpenseClaimDocumentWithRelations>>> {
        const result = await expenseClaimDocumentRepository.findMany(criteria);
        return success(result);
    },
};

