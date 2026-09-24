"use server";

/**
 * ExpenseClaimDocument Server Actions
 *
 * Server actions for managing expense claim documents
 *
 * @module app/actions/expense-claim-document
 */

import { requireReadableClaim, resolveClaimReadScope } from "@/lib/domains/expense-claim-document/read-scope";
import { revalidatePath } from "next/cache";
import { bangkokCurrentMonth } from "@/lib/shared/format";
import { isClaimMutationLocked } from "@/lib/shared/claim-mutation";
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
 * List eligible off-site work for the caller creating a claim or an authorized
 * editor updating an existing claim's actual claimant.
 */
export async function listEligibleOffSiteWorksForClaim(
    month?: string,
    claimId?: string
): Promise<Result<EligibleOffSiteWorkOption[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existing = claimId !== undefined
        ? await expenseClaimDocumentRepository.findById(claimId)
        : null;
    if (claimId !== undefined && !existing) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }

    const targetUserId = existing?.userId ?? session.user.dbUserId;
    const canSelect = await can(
        session.user.dbUserId,
        "EXPENSE_CLAIM",
        existing ? "UPDATE" : "CREATE",
        { targetOwnerId: targetUserId }
    );

    if (!canSelect) {
        return {
            success: false,
            error: "Permission denied",
            code: "PERMISSION_DENIED",
        };
    }

    if (existing && isClaimMutationLocked(existing)) {
        return {
            success: false,
            error: "ไม่สามารถแก้ไขเอกสารที่รวบรวม อนุมัติ หรือยกเลิกแล้วได้",
            code: "CLAIM_LOCKED",
        };
    }

    const monthValue = month ?? bangkokCurrentMonth();
    if (typeof monthValue !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)) {
        return {
            success: false,
            error: "กรุณาเลือกเดือนและปี พ.ศ. ให้ถูกต้อง",
            code: "INVALID_MONTH",
        };
    }
    const targetMonth = new Date(`${monthValue}-01T00:00:00.000Z`);

    return expenseClaimDocumentService.listEligibleOffSiteWorksForUser(
        targetUserId,
        targetMonth
    );
}

/**
 * List expense claim documents with permission-aware visibility.
 *
 * Scope resolution:
 *   LIST:ALL  → return all documents for an unbound role
 *   LIST:DEPARTMENT → constrain to exact permitted departments
 *   LIST:OWN  → return only the caller’s own documents (employee)
 *   READ      → own-only fallback when the caller can read their own document
 *   else      → PERMISSION_DENIED
 */
export async function listExpenseClaimDocuments(
    filters?: ExpenseClaimDocumentFilterCriteria
): Promise<Result<PaginatedResult<ExpenseClaimDocumentWithRelations>>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const scope = await resolveClaimReadScope(session.user.dbUserId);
    if (!scope.success) return scope;
    return expenseClaimDocumentService.list(scope.data.scope !== "OWN"
        ? filters ?? {}
        : { ...(filters ?? {}), userId: scope.data.userId }, scope.data.where);
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

    const readable = await requireReadableClaim(id, session.user.dbUserId);
    if (!readable.success) return readable;

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
    if (result.success) {
        revalidatePath("/expense-claim-document");
        revalidatePath("/dashboard");
    }
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
    if (result.success) {
        revalidatePath("/expense-claim-document");
        revalidatePath("/dashboard");
    }
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
    if (result.success) {
        revalidatePath("/expense-claim-document");
        revalidatePath("/dashboard");
    }
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
    if (result.success) {
        revalidatePath("/expense-claim-document");
        revalidatePath("/dashboard");
    }
    return result;
}
