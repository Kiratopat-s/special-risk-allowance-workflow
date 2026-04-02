"use server";

/**
 * ExpenseClaimDocument Server Actions
 *
 * Server actions for managing expense claim documents
 *
 * @module app/actions/expense-claim-document
 */

import { revalidatePath } from "next/cache";
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
 * List expense claim documents with permission-aware visibility.
 *
 * Scope resolution:
 *   LIST:ALL  → return all documents (collector, hpa, rk, drt)
 *   LIST:OWN  → return only the caller’s own documents (employee)
 *   READ:OWN  → fallback, same as LIST:OWN
 *   else      → PERMISSION_DENIED
 */
export async function listExpenseClaimDocuments(
    filters?: ExpenseClaimDocumentFilterCriteria
): Promise<Result<PaginatedResult<ExpenseClaimDocumentWithRelations>>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const userId = session.user.dbUserId;

    // Check whether the caller can list their own documents at minimum.
    // Passing targetOwnerId = userId makes OWN scope resolve correctly.
    const canListOwn = await can(userId, "EXPENSE_CLAIM", "LIST", {
        targetOwnerId: userId,
    });

    if (!canListOwn) {
        // Fallback: READ:OWN is sufficient to view own claims (no LIST permission assigned).
        const canReadOwn = await can(userId, "EXPENSE_CLAIM", "READ", {
            targetOwnerId: userId,
        });
        if (!canReadOwn) {
            return {
                success: false,
                error: "Permission denied",
                code: "PERMISSION_DENIED",
            };
        }
        return expenseClaimDocumentService.list({ ...(filters ?? {}), userId });
    }

    // Distinguish LIST:ALL from LIST:OWN by using a NIL-UUID sentinel.
    // OWN scope will deny (sentinel ≠ userId); ALL scope will allow.
    const canListAll = await can(userId, "EXPENSE_CLAIM", "LIST", {
        targetOwnerId: "00000000-0000-0000-0000-000000000000",
    });

    if (canListAll) {
        // ALL scope — collector / hpa / rk / drt see every document.
        return expenseClaimDocumentService.list(filters ?? {});
    }

    // OWN scope — employee sees only their own documents.
    return expenseClaimDocumentService.list({ ...(filters ?? {}), userId });
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

    const result = await expenseClaimDocumentService.create(data, session.user.dbUserId, targetUserId);
    if (result.success) revalidatePath("/expense-claim-document");
    return result;
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

    const result = await expenseClaimDocumentService.update(id, data, session.user.dbUserId);
    if (result.success) revalidatePath("/expense-claim-document");
    return result;
}

/**
 * Submit a DRAFT expense claim document.
 * Checks all linked OSWs have leaders, creates verifications, transitions to PENDING_LEADER_VERIFY.
 */
export async function submitDraftExpenseClaimDocument(
    id: string
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

    const result = await expenseClaimDocumentService.submitDraft(id, session.user.dbUserId);
    if (result.success) revalidatePath("/expense-claim-document");
    return result;
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

    const result = await expenseClaimDocumentService.delete(id, session.user.dbUserId);
    if (result.success) revalidatePath("/expense-claim-document");
    return result;
}

