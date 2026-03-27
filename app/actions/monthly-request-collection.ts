"use server";

/**
 * MonthlyRequestCollection Server Actions
 *
 * Permission model:
 *   MONTHLY_REQUEST:MANAGE  — admin operations (create, update, submit, cancel)
 *   MONTHLY_REQUEST:LIST    — list all collections
 *   MONTHLY_REQUEST:READ    — view single collection
 *   MONTHLY_REQUEST:SUBMIT  — HPA_CHECK and RK_CHECK review steps
 *   MONTHLY_REQUEST:APPROVE — OK_APPROVE review step
 *
 * @module app/actions/monthly-request-collection
 */

import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import {
    monthlyRequestCollectionService,
    monthlyRequestCollectionRepository,
} from "@/lib/domains/monthly-request-collection";
import type { Result, PaginatedResult } from "@/lib/shared/types";
import type {
    MonthlyRequestCollectionEntity,
    MonthlyRequestCollectionWithRelations,
    EligibleExpenseClaimForCollection,
    CreateMrcInput,
    UpdateMrcInput,
    ReviewMrcStepInput,
    MrcFilterCriteria,
} from "@/lib/domains/monthly-request-collection";

/**
 * List monthly request collections (paginated, filtered)
 */
export async function listMonthlyRequestCollections(
    filters?: MrcFilterCriteria
): Promise<Result<PaginatedResult<MonthlyRequestCollectionWithRelations>>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canList = await can(session.user.dbUserId, "MONTHLY_REQUEST", "LIST");
    if (!canList) {
        // Fall back to own collections only
        const canRead = await can(session.user.dbUserId, "MONTHLY_REQUEST", "READ");
        if (!canRead) {
            return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
        }
        return monthlyRequestCollectionService.list({
            ...(filters ?? {}),
            collectorId: session.user.dbUserId,
        });
    }

    return monthlyRequestCollectionService.list(filters ?? {});
}

/**
 * Get a single monthly request collection by ID
 */
export async function getMonthlyRequestCollection(
    id: string
): Promise<Result<MonthlyRequestCollectionWithRelations>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const mrc = await monthlyRequestCollectionRepository.findById(id);
    if (!mrc) {
        return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
    }

    // Collector can always read their own, or user needs READ/LIST/MANAGE permission
    const isOwn = mrc.collectorId === session.user.dbUserId;
    if (!isOwn) {
        const canRead = await can(session.user.dbUserId, "MONTHLY_REQUEST", "READ");
        if (!canRead) {
            return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
        }
    }

    return monthlyRequestCollectionService.getById(id);
}

/**
 * List PENDING expense claims eligible for collection in a given month.
 * Only available to users with MANAGE permission.
 */
export async function listEligibleExpenseClaimsForMonth(
    month: string,
    existingMrcId?: string
): Promise<Result<EligibleExpenseClaimForCollection[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canManage = await can(session.user.dbUserId, "MONTHLY_REQUEST", "MANAGE");
    if (!canManage) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    const targetMonth = new Date(`${month}-01`);
    if (Number.isNaN(targetMonth.getTime())) {
        return {
            success: false,
            error: "Invalid month format. Expected YYYY-MM (for example, 2025-01).",
            code: "INVALID_MONTH",
        };
    }

    return monthlyRequestCollectionService.listEligibleExpenseClaims(targetMonth, existingMrcId);
}

/**
 * Create a new monthly request collection (admin only — MANAGE permission)
 */
export async function createMonthlyRequestCollection(
    data: CreateMrcInput
): Promise<Result<MonthlyRequestCollectionEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canManage = await can(session.user.dbUserId, "MONTHLY_REQUEST", "MANAGE");
    if (!canManage) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return monthlyRequestCollectionService.create(data, session.user.dbUserId);
}

/**
 * Update expense claims linked to a DRAFT collection (admin only)
 */
export async function updateMonthlyRequestCollection(
    id: string,
    data: UpdateMrcInput
): Promise<Result<MonthlyRequestCollectionEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existing = await monthlyRequestCollectionRepository.findById(id);
    if (!existing) {
        return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
    }

    const isOwn = existing.collectorId === session.user.dbUserId;
    const canManage = await can(session.user.dbUserId, "MONTHLY_REQUEST", "MANAGE");
    if (!canManage && !isOwn) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return monthlyRequestCollectionService.update(id, data, session.user.dbUserId);
}

/**
 * Submit a DRAFT collection for review (creates HPA_CHECK step)
 */
export async function submitMonthlyRequestCollection(
    id: string
): Promise<Result<MonthlyRequestCollectionEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existing = await monthlyRequestCollectionRepository.findById(id);
    if (!existing) {
        return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
    }

    const isOwn = existing.collectorId === session.user.dbUserId;
    const canManage = await can(session.user.dbUserId, "MONTHLY_REQUEST", "MANAGE");
    if (!canManage && !isOwn) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return monthlyRequestCollectionService.submit(id, session.user.dbUserId);
}

/**
 * Review a step in the approval chain.
 * HPA_CHECK and RK_CHECK require SUBMIT permission.
 * OK_APPROVE requires APPROVE permission.
 */
export async function reviewMonthlyRequestCollectionStep(
    id: string,
    input: ReviewMrcStepInput
): Promise<Result<MonthlyRequestCollectionEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const isFinalApproval = input.stage === "OK_APPROVE";
    const requiredAction = isFinalApproval ? "APPROVE" : "SUBMIT";

    const hasPerm = await can(session.user.dbUserId, "MONTHLY_REQUEST", requiredAction);
    if (!hasPerm) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return monthlyRequestCollectionService.reviewStep(id, input, session.user.dbUserId);
}

/**
 * Cancel a collection (admin — MANAGE permission, no approved steps)
 */
export async function cancelMonthlyRequestCollection(
    id: string
): Promise<Result<void>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const existing = await monthlyRequestCollectionRepository.findById(id);
    if (!existing) {
        return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
    }

    const isOwn = existing.collectorId === session.user.dbUserId;
    const canManage = await can(session.user.dbUserId, "MONTHLY_REQUEST", "MANAGE");
    if (!canManage && !isOwn) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return monthlyRequestCollectionService.cancel(id, session.user.dbUserId);
}
