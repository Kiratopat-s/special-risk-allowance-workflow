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
import { holidayCalendarService } from "@/lib/domains/holiday-calendar";
import type { HolidayResolution } from "@/lib/domains/holiday-calendar";
import { authorizationService } from "@/lib/domains/permission";
import type { Result, PaginatedResult } from "@/lib/shared/types";
import type {
    ExpenseClaimDocumentEntity,
    ExpenseClaimDocumentWithRelations,
    EligibleOffSiteWorkOption,
    CreateExpenseClaimDocumentInput,
    UpdateExpenseClaimDocumentInput,
    ExpenseClaimDocumentFilterCriteria,
} from "@/lib/domains/expense-claim-document";

export async function resolveHolidayDatesForClaim(
    dates: string[],
): Promise<Result<HolidayResolution[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }
    if (dates.length > 62) {
        return { success: false, error: "Too many dates", code: "TOO_MANY_DATES" };
    }
    try {
        const resolved = await holidayCalendarService.resolveDates(dates);
        return { success: true, data: dates.map((date) => resolved.get(date)!).filter(Boolean) };
    } catch {
        return { success: false, error: "Invalid date", code: "INVALID_DATE" };
    }
}

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
 *   LIST:ALL  → return all documents (collector or administrator)
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

    // Inspect the matched scope explicitly. The generic guard cannot infer
    // LIST:ALL from an absent target and DEPARTMENT must never widen to ALL.
    const permissionResult = await authorizationService.getUserPermissions(userId);
    const permissions = permissionResult.success ? permissionResult.data : [];
    const canListAll = permissions.some(
        (permission) =>
            permission.resource === "EXPENSE_CLAIM" &&
            (permission.action === "MANAGE" ||
                (permission.action === "LIST" && permission.scope === "ALL")),
    );

    if (canListAll) {
        // ALL scope — collectors and administrators see every document.
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

    const existingResult = await expenseClaimDocumentService.getById(id, true);
    if (!existingResult.success) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }
    const existing = existingResult.data;

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

    return existingResult;
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

    const result = await expenseClaimDocumentService.saveClaimDraft(
        data,
        session.user.dbUserId,
        targetUserId,
    );
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

    const existingResult = await expenseClaimDocumentService.getById(id);
    if (!existingResult.success) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }
    const existing = existingResult.data;

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

    const result = existing.status === "DRAFT"
        ? await expenseClaimDocumentService.saveClaimDraft(
            data,
            session.user.dbUserId,
            existing.userId,
            id,
        )
        : await expenseClaimDocumentService.startClaimCorrection(
            id,
            data,
            session.user.dbUserId,
        );
    if (result.success) {
        revalidatePath("/expense-claim-document");
        revalidatePath("/dashboard");
    }
    return result;
}

/**
 * Submit a DRAFT expense claim document.
 * Checks all linked OSWs have leaders, creates verifications, and transitions
 * to PENDING_LEADER_CONFIRMATION.
 */
export async function submitDraftExpenseClaimDocument(
    id: string
): Promise<Result<ExpenseClaimDocumentEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existingResult = await expenseClaimDocumentService.getById(id);
    if (!existingResult.success) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }
    const existing = existingResult.data;

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

    const result = existing.currentRevisionNo > 1
        ? await expenseClaimDocumentService.resubmitClaim(id, session.user.dbUserId)
        : await expenseClaimDocumentService.submitClaim(id, session.user.dbUserId);
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

    const existingResult = await expenseClaimDocumentService.getById(id);
    if (!existingResult.success) {
        return { success: false, error: "Expense claim document not found", code: "CLAIM_NOT_FOUND" };
    }
    const existing = existingResult.data;

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

    const result = await expenseClaimDocumentService.cancelClaim(id, session.user.dbUserId);
    if (result.success) {
        revalidatePath("/expense-claim-document");
        revalidatePath("/dashboard");
    }
    return result;
}
