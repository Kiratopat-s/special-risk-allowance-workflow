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

    const canList = await can(session.user.dbUserId, "MONTHLY_REQUEST", "LIST");
    if (!canList) {
        // Fall back to own collections only
        const canRead = await can(session.user.dbUserId, "MONTHLY_REQUEST", "READ");
        if (!canRead) {
            return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
        }
        const fallbackResult = await monthlyRequestCollectionService.list({
            ...(filters ?? {}),
            collectorId: session.user.dbUserId,
        });
        if (!fallbackResult.success) return fallbackResult;
        return {
            ...fallbackResult,
            data: {
                ...fallbackResult.data,
                data: fallbackResult.data.data.map(serializeMrc),
            },
        };
    }

    // MANAGE holders see everything
    const userId = session.user.dbUserId;
    const canManageList = await can(userId, "MONTHLY_REQUEST", "MANAGE");
    const result = await monthlyRequestCollectionService.list(filters ?? {});
    if (!result.success) return result;

    if (canManageList) {
        return {
            ...result,
            data: {
                ...result.data,
                data: result.data.data.map(serializeMrc),
            },
        };
    }

    // Non-MANAGE: determine user's review capabilities for PENDING filtering
    const [isSuperAdmin, exactHpa, exactRk, exactOk] = await Promise.all([
        hasRole(userId, "super-admin"),
        canExact(userId, "MONTHLY_REQUEST", "REVIEW_HPA"),
        canExact(userId, "MONTHLY_REQUEST", "REVIEW_RK"),
        canExact(userId, "MONTHLY_REQUEST", "REVIEW_OK"),
    ]);

    const isReviewer = exactHpa || exactRk || exactOk;

    const visibleData = result.data.data.filter((mrc) => {
        // DRAFT: own only
        if (mrc.status === "DRAFT") {
            return mrc.collectorId === userId;
        }
        // PENDING: stage-based visibility for reviewers
        if (mrc.status === "PENDING") {
            if (isSuperAdmin) return true;
            if (mrc.collectorId === userId) return true;
            // Non-reviewer LIST holders see all PENDING (read-only viewers)
            if (!isReviewer) return true;
            // Reviewer: only see MRCs that have reached their stage
            const stepStatus = (stage: string) =>
                mrc.approvalSteps.find((s) => s.stage === stage)?.status;
            if (exactHpa) return true; // HPA is first step, always visible
            if (exactRk && stepStatus("HPA_CHECK") === "APPROVED") return true;
            if (exactOk && stepStatus("HPA_CHECK") === "APPROVED" && stepStatus("RK_CHECK") === "APPROVED") return true;
            return false;
        }
        // APPROVED, REJECTED, CANCELLED: visible to all LIST holders
        return true;
    });

    return {
        ...result,
        data: {
            ...result.data,
            data: visibleData.map(serializeMrc),
        },
    };
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

    // DRAFT MRCs are only visible to collector + MANAGE holders
    if (mrc.status === "DRAFT" && !isOwn) {
        const canManageDraft = await can(session.user.dbUserId, "MONTHLY_REQUEST", "MANAGE");
        if (!canManageDraft) {
            return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
        }
    }

    const result = await monthlyRequestCollectionService.getById(id);
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
            error: "Invalid month format. Expected YYYY-MM (for example, 2025-01).",
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
 * MANAGE permission bypasses stage checks (admin).
 * HPA_CHECK requires REVIEW_HPA, RK_CHECK requires REVIEW_RK, OK_APPROVE requires REVIEW_OK.
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

    // Only super-admin role can bypass per-stage permission checks
    const isSuperAdmin = await hasRole(userId, "super-admin");

    // Per-stage permission check (exact match — no MANAGE escalation)
    let hasStageAccess = false;
    if (input.stage === "HPA_CHECK") {
        hasStageAccess = isSuperAdmin || await canExact(userId, "MONTHLY_REQUEST", "REVIEW_HPA");
    } else if (input.stage === "RK_CHECK") {
        hasStageAccess = isSuperAdmin || await canExact(userId, "MONTHLY_REQUEST", "REVIEW_RK");
    } else if (input.stage === "OK_APPROVE") {
        hasStageAccess = isSuperAdmin || await canExact(userId, "MONTHLY_REQUEST", "REVIEW_OK");
    }

    if (!hasStageAccess) {
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

    // Pre-flight ordering check — all prior stages in HPA→RK→OK must be APPROVED
    const STAGE_ORDER: readonly string[] = ["HPA_CHECK", "RK_CHECK", "OK_APPROVE"];
    const stageIdx = STAGE_ORDER.indexOf(input.stage);
    if (stageIdx > 0) {
        const mrc = await monthlyRequestCollectionRepository.findById(id);
        if (!mrc || mrc.status !== "PENDING") {
            return { success: false, error: "ไม่พบรายการหรือสถานะไม่ถูกต้อง", code: "MRC_NOT_PENDING" };
        }
        for (let i = 0; i < stageIdx; i++) {
            const priorStep = await monthlyRequestCollectionRepository.findApprovalStep(
                id,
                STAGE_ORDER[i] as "HPA_CHECK" | "RK_CHECK" | "OK_APPROVE"
            );
            if (!priorStep || priorStep.status !== "APPROVED") {
                return {
                    success: false,
                    error: "ขั้นตอนก่อนหน้ายังไม่ได้รับการอนุมัติ",
                    code: "STEP_SEQUENCE_VIOLATED",
                };
            }
        }
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
