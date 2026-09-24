/**
 * ExpenseClaimDocument Domain - Service Layer
 *
 * Business logic layer for expense claim document operations
 *
 * @module lib/domains/expense-claim-document/service
 */

import { expenseClaimDocumentRepository } from "./repository";
import { requireReadableClaim } from "./read-scope";
import { toClaimPrintDocument } from "./print-data";
import type { ClaimPrintDocument } from "@/lib/shared/types/claim-print";
import { offSiteWorkEmployeeService } from "@/lib/domains/off-site-work/employee-service";
import { actionLogService } from "@/lib/domains/action-log/service";
import { leaderVerificationService } from "@/lib/domains/leader-verification";
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

function claimAuditData(claim: ExpenseClaimDocumentEntity): JsonValue {
    return {
        id: claim.id, userId: claim.userId, expenseMonth: claim.expenseMonth.toISOString(),
        claimantPositionAtSubmission: claim.claimantPositionAtSubmission,
        selectedDates: claim.selectedDates, countDates: claim.countDates, amount: claim.amount,
        status: claim.status, remark: claim.remark,
    };
}

export const expenseClaimDocumentService = {
    async getPrintData(id: string, actorId: string): Promise<Result<ClaimPrintDocument>> {
        const readable = await requireReadableClaim(id, actorId);
        if (!readable.success) return readable;
        const claim = readable.data;
        if (claim.status === "CANCELLED") {
            return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
        }
        const data = await expenseClaimDocumentRepository.findForPrint(id, claim.userId);
        return data ? success(toClaimPrintDocument(data)) : error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    },
    /**
     * List eligible off-site works for claim creation
     */
    async listEligibleOffSiteWorksForUser(
        userId: string,
        month: Date
    ): Promise<Result<EligibleOffSiteWorkOption[]>> {
        const linked = await offSiteWorkEmployeeService.linkForUser(userId);
        if (!linked.success) return linked;
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
        const result = await expenseClaimDocumentRepository.createWithSelection(data, targetUserId, actorId);
        if (!result.success) return result;
        const { claim, verificationsReset } = result.data;
        if (verificationsReset) await leaderVerificationService.notifyForClaim(claim.id);
        await actionLogService.log({
            userId: actorId, actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${claim.id}" created`,
            targetEntityType: "ExpenseClaim", targetEntityId: claim.id,
            newData: claimAuditData(claim),
            ...context,
        });
        return success(claim, "Expense claim document created successfully");
    },

    /** Edit content and invalidate old signatures in the same locked transaction. */
    async update(
        id: string, data: UpdateExpenseClaimDocumentInput, actorId: string, context?: RequestContext,
    ): Promise<Result<ExpenseClaimDocumentEntity>> {
        const result = await expenseClaimDocumentRepository.updateEditable(id, data);
        if (!result.success) return result;
        const { claim, previous, verificationsReset } = result.data;
        if (verificationsReset) await leaderVerificationService.notifyForClaim(id);
        await actionLogService.log({
            userId: actorId, actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" updated`, targetEntityType: "ExpenseClaim", targetEntityId: id,
            previousData: previous ? claimAuditData(previous) : undefined,
            newData: claimAuditData(claim),
            ...context,
        });
        return success(claim, "Expense claim document updated successfully");
    },

    /** Revalidate stored dates and totals before the first submission. */
    async submitDraft(
        id: string, actorId: string, context?: RequestContext,
    ): Promise<Result<ExpenseClaimDocumentEntity>> {
        const result = await expenseClaimDocumentRepository.submitDraftWithSelection(id, actorId);
        if (!result.success) return result;
        const { claim, verificationsReset } = result.data;
        if (verificationsReset) await leaderVerificationService.notifyForClaim(id);
        await actionLogService.log({
            userId: actorId, actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" submitted from DRAFT`, targetEntityType: "ExpenseClaim", targetEntityId: id,
            previousData: { status: "DRAFT" }, newData: { status: claim.status }, ...context,
        });
        return success(claim, "Expense claim document submitted successfully");
    },

    /** Cancellation rechecks collection membership while holding the claim lock. */
    async delete(id: string, actorId: string, context?: RequestContext): Promise<Result<void>> {
        const result = await expenseClaimDocumentRepository.cancelEditable(id);
        if (!result.success) return result;
        await actionLogService.log({
            userId: actorId, actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" cancelled`, targetEntityType: "ExpenseClaim", targetEntityId: id,
            previousData: { status: result.data.status, cancelledAt: result.data.cancelledAt } as unknown as JsonValue,
            ...context,
        });
        return success(undefined, "Expense claim document cancelled successfully");
    },

    /**
     * List claim documents with filters
     */
    async list(
        criteria: ExpenseClaimDocumentFilterCriteria,
        visibilityWhere: Prisma.ExpenseClaimWhereInput = {}
    ): Promise<Result<PaginatedResult<ExpenseClaimDocumentWithRelations>>> {
        const result = await expenseClaimDocumentRepository.findMany(criteria, visibilityWhere);
        return success(result);
    },
};
