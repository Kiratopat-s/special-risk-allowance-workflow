"use server";

/**
 * MonthlyRequestCollection Server Actions
 *
 * Permission model:
 *   MONTHLY_REQUEST:MANAGE  — admin operations (create, update, submit, cancel)
 *   MONTHLY_REQUEST:LIST    — list all collections
 *   MONTHLY_REQUEST:READ    — view single collection
 *   MONTHLY_REQUEST:REVIEW_HPA — final review and signing in this system
 *
 * @module app/actions/monthly-request-collection
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { can, canExact, hasRole } from "@/lib/auth/permissions";
import {
    monthlyRequestCollectionService,
    monthlyRequestCollectionRepository,
} from "@/lib/domains/monthly-request-collection";
import { signatureRepository } from "@/lib/domains/signature";
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

// ---------------------------------------------------------------------------
// Serialization helpers — Prisma Decimal is not a plain object; convert to string
// ---------------------------------------------------------------------------

function serializeDecimal(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    return String(v);
}

function serializeMrc(
    mrc: MonthlyRequestCollectionWithRelations,
): MonthlyRequestCollectionWithRelations {
    return {
        ...mrc,
        countDates: serializeDecimal(mrc.countDates) as unknown as typeof mrc.countDates,
        amount: serializeDecimal(mrc.amount) as unknown as typeof mrc.amount,
        expenseClaims: mrc.expenseClaims.map((c) => ({
            ...c,
            countDates: serializeDecimal(c.countDates) as unknown as typeof c.countDates,
            amount: serializeDecimal(c.amount) as unknown as typeof c.amount,
        })),
    };
}

function serializeMrcEntity(
    mrc: MonthlyRequestCollectionEntity,
): MonthlyRequestCollectionEntity {
    return {
        ...mrc,
        countDates: serializeDecimal(mrc.countDates) as unknown as typeof mrc.countDates,
        amount: serializeDecimal(mrc.amount) as unknown as typeof mrc.amount,
    };
}

function serializeEligibleClaim(
    c: EligibleExpenseClaimForCollection,
): EligibleExpenseClaimForCollection {
    return {
        ...c,
        countDates: serializeDecimal(c.countDates) as unknown as typeof c.countDates,
        amount: serializeDecimal(c.amount) as unknown as typeof c.amount,
    };
}

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

    const result = await monthlyRequestCollectionService.list(filters ?? {}, session.user.dbUserId);
    if (!result.success) return result;
    return { ...result, data: { ...result.data, data: result.data.data.map(serializeMrc) } };
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

    const result = await monthlyRequestCollectionService.getById(id, session.user.dbUserId);
    if (!result.success) return result;
    return { ...result, data: serializeMrc(result.data) };
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
            error: "กรุณาเลือกเดือนและปี พ.ศ. ให้ถูกต้อง",
            code: "INVALID_MONTH",
        };
    }

    const result = await monthlyRequestCollectionService.listEligibleExpenseClaims(targetMonth, existingMrcId);
    if (!result.success) return result;
    return { ...result, data: result.data.map(serializeEligibleClaim) };
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

    const result = await monthlyRequestCollectionService.create(data, session.user.dbUserId);
    if (!result.success) return result;
    revalidatePath("/monthly-request-collection");
    revalidatePath("/dashboard");
    return { ...result, data: serializeMrcEntity(result.data) };
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

    const result = await monthlyRequestCollectionService.update(id, data, session.user.dbUserId);
    if (!result.success) return result;
    revalidatePath("/monthly-request-collection");
    revalidatePath("/dashboard");
    return { ...result, data: serializeMrcEntity(result.data) };
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

    const result = await monthlyRequestCollectionService.submit(id, session.user.dbUserId);
    if (!result.success) return result;
    revalidatePath("/monthly-request-collection");
    revalidatePath("/dashboard");
    return { ...result, data: serializeMrcEntity(result.data) };
}

/**
 * Review a step in the approval chain.
 * Only REVIEW_HPA or the super-admin role can review the single HPA_CHECK step.
 * Approver must have an active signature before any review action.
 */
export async function reviewMonthlyRequestCollectionStep(
    id: string,
    input: ReviewMrcStepInput
): Promise<Result<MonthlyRequestCollectionEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const userId = session.user.dbUserId;

    if (!input || input.stage !== "HPA_CHECK") {
        return { success: false, error: "รองรับเฉพาะการอนุมัติของ หผ.", code: "INVALID_APPROVAL_STAGE" };
    }
    const isSuperAdmin = await hasRole(userId, "super-admin");
    if (!isSuperAdmin && !(await canExact(userId, "MONTHLY_REQUEST", "REVIEW_HPA"))) {
        return { success: false, error: "ไม่มีสิทธิ์ในขั้นตอนนี้", code: "PERMISSION_DENIED" };
    }

    // Signature guard — approver must have an active signature
    const activeSig = await signatureRepository.findActiveByUserId(userId);
    if (!activeSig) {
        return {
            success: false,
            error: "กรุณาลงลายมือชื่อก่อนอนุมัติเอกสาร",
            code: "SIGNATURE_REQUIRED",
        };
    }

    const result = await monthlyRequestCollectionService.reviewStep(id, input, userId);
    if (!result.success) return result;
    revalidatePath("/monthly-request-collection");
    revalidatePath("/dashboard");
    return { ...result, data: serializeMrcEntity(result.data) };
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

    const cancelResult = await monthlyRequestCollectionService.cancel(id, session.user.dbUserId);
    if (cancelResult.success) {
        revalidatePath("/monthly-request-collection");
        revalidatePath("/dashboard");
    }
    return cancelResult;
}
