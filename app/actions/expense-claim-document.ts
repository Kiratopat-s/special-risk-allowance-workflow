"use server";

/**
 * ExpenseClaimDocument Server Actions
 *
 * Server actions for managing expense claim documents
 *
 * @module app/actions/expense-claim-document
 */

import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { expenseClaimDocumentService } from "@/lib/domains/expense-claim-document";
import { expenseClaimDocumentRepository } from "@/lib/domains/expense-claim-document";
import type { Result, PaginatedResult } from "@/lib/shared/types";
import type {
    ExpenseClaimDocumentEntity,
    ExpenseClaimDocumentWithRelations,
    EligibleOffSiteWorkOption,
    CreateExpenseClaimDocumentInput,
    UpdateExpenseClaimDocumentInput,
    ExpenseClaimDocumentFilterCriteria,
} from "@/lib/domains/expense-claim-document";

/**
 * List off-site work options eligible for creating expense claim for current user
 */
export async function listEligibleOffSiteWorksForClaim(
    month?: string
): Promise<Result<EligibleOffSiteWorkOption[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canCreateOwn = await can(session.user.dbUserId, "EXPENSE_CLAIM", "CREATE", {
        targetOwnerId: session.user.dbUserId,
    });

    if (!canCreateOwn) {
        return {
            success: false,
            error: "Permission denied",
            code: "PERMISSION_DENIED",
        };
    }

    const targetMonth = month ? new Date(`${month}-01`) : new Date();
    if (Number.isNaN(targetMonth.getTime())) {
        return {
            success: false,
            error: "Invalid month format",
            code: "INVALID_MONTH",
        };
    }

    return expenseClaimDocumentService.listEligibleOffSiteWorksForUser(
        session.user.dbUserId,
        targetMonth
    );
}

/**
 * List expense claim documents with permission-aware visibility
 */
export async function listExpenseClaimDocuments(
    filters?: ExpenseClaimDocumentFilterCriteria
): Promise<Result<PaginatedResult<ExpenseClaimDocumentWithRelations>>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canList = await can(session.user.dbUserId, "EXPENSE_CLAIM", "LIST");
    if (!canList) {
        const canReadOwn = await can(session.user.dbUserId, "EXPENSE_CLAIM", "READ", {
            targetOwnerId: session.user.dbUserId,
        });
        if (!canReadOwn) {
            return {
                success: false,
                error: "Permission denied",
                code: "PERMISSION_DENIED",
            };
        }

        return expenseClaimDocumentService.list({
            ...(filters ?? {}),
            userId: session.user.dbUserId,
        });
    }

    return expenseClaimDocumentService.list(filters ?? {});
}

/**
 * Get expense claim document by ID with ownership-aware read check
 */
export async function getExpenseClaimDocument(
    id: string
): Promise<Result<ExpenseClaimDocumentWithRelations>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existing = await expenseClaimDocumentRepository.findById(id);
    if (!existing) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }

    const canRead = await can(session.user.dbUserId, "EXPENSE_CLAIM", "READ", {
        targetOwnerId: existing.userId,
    });

    if (!canRead) {
        return {
            success: false,
            error: "Permission denied",
            code: "PERMISSION_DENIED",
        };
    }

    return expenseClaimDocumentService.getById(id);
}

/**
 * Create expense claim document
 */
export async function createExpenseClaimDocument(
    data: CreateExpenseClaimDocumentInput
): Promise<Result<ExpenseClaimDocumentEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const targetUserId = data.userId ?? session.user.dbUserId;

    const canCreate = await can(session.user.dbUserId, "EXPENSE_CLAIM", "CREATE", {
        targetOwnerId: targetUserId,
    });
    if (!canCreate) {
        return {
            success: false,
            error: "Permission denied",
            code: "PERMISSION_DENIED",
        };
    }

    return expenseClaimDocumentService.create(data, session.user.dbUserId, targetUserId);
}

/**
 * Update expense claim document
 */
export async function updateExpenseClaimDocument(
    id: string,
    data: UpdateExpenseClaimDocumentInput
): Promise<Result<ExpenseClaimDocumentEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existing = await expenseClaimDocumentRepository.findById(id);
    if (!existing) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }

    const canUpdate = await can(session.user.dbUserId, "EXPENSE_CLAIM", "UPDATE", {
        targetOwnerId: existing.userId,
    });
    if (!canUpdate) {
        return {
            success: false,
            error: "Permission denied",
            code: "PERMISSION_DENIED",
        };
    }

    return expenseClaimDocumentService.update(id, data, session.user.dbUserId);
}

/**
 * Soft-delete expense claim document by cancellation
 */
export async function deleteExpenseClaimDocument(id: string): Promise<Result<void>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existing = await expenseClaimDocumentRepository.findById(id);
    if (!existing) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }

    const canDelete = await can(session.user.dbUserId, "EXPENSE_CLAIM", "DELETE", {
        targetOwnerId: existing.userId,
    });
    if (!canDelete) {
        return {
            success: false,
            error: "Permission denied",
            code: "PERMISSION_DENIED",
        };
    }

    return expenseClaimDocumentService.delete(id, session.user.dbUserId);
}

