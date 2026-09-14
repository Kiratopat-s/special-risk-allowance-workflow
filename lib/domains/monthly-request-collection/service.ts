/**
 * MonthlyRequestCollection Domain - Service Layer
 *
 * Business logic and state-machine for the full MRC approval lifecycle.
 *
 * DRAFT → PENDING → APPROVED (HPA signs once; linked claims become APPROVED).
 * Rejection/cancellation releases linked claims for collection again.
 * RK/OK signing takes place in the organization's document system.
 *
 * @module lib/domains/monthly-request-collection/service
 */

import { monthlyRequestCollectionRepository as repo } from "./repository";
import { canExact, hasRole } from "@/lib/auth/permissions";
import { resolveCollectionReadAccess } from "./read-access";
import { canSeeCollection } from "./read-policy";
import { toClaimPrintDocument } from "@/lib/domains/expense-claim-document/print-data";
import type { ClaimPrintDocument } from "@/lib/shared/types/claim-print";
import { permissionRepository } from "@/lib/domains/permission/repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { notificationService } from "@/lib/domains/notification";
import { ActionType } from "@/lib/shared/types";
import { success, error, type Result } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/shared/types";
import type {
    MonthlyRequestCollectionEntity,
    MrcSummaryPrintData,
    MonthlyRequestCollectionWithRelations,
    CreateMrcInput,
    UpdateMrcInput,
    ReviewMrcStepInput,
    MrcFilterCriteria,
    EligibleExpenseClaimForCollection,
} from "./types";

type JsonValue = Prisma.JsonValue;

function normalizeMonth(value: Date | string): Date {
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export const monthlyRequestCollectionService = {
    async getClaimsPrintData(id: string, actorId: string): Promise<Result<ClaimPrintDocument[]>> {
        const access = await resolveCollectionReadAccess(actorId);
        if (!access.success) return access;
        const collection = await repo.findPrintAccess(id);
        if (!collection) return error("ไม่พบชุดรวบรวมรายเดือน", "MRC_NOT_FOUND");
        if (!canSeeCollection(collection, access.data)) {
            return error("ไม่มีสิทธิ์อ่านชุดรวบรวมรายเดือนนี้", "PERMISSION_DENIED");
        }
        const data = await repo.findClaimsForPrint(id, access.data);
        if (!data) return error("ไม่พบชุดรวบรวมรายเดือนที่อ่านได้", "MRC_NOT_FOUND");
        return success(data.expenseClaims.map(toClaimPrintDocument));
    },
    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    async getById(id: string, actorId: string): Promise<Result<MonthlyRequestCollectionWithRelations>> {
        const access = await resolveCollectionReadAccess(actorId);
        if (!access.success) return access;
        const mrc = await repo.findWithRelations(id);
        if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
        if (!canSeeCollection(mrc, access.data)) return error("ไม่มีสิทธิ์อ่านรายการนี้", "PERMISSION_DENIED");
        return success(mrc);
    },

    async getSummaryPrintData(id: string, actorId: string): Promise<Result<MrcSummaryPrintData>> {
        const access = await resolveCollectionReadAccess(actorId);
        if (!access.success) return access;
        const mrc = await repo.findPrintAccess(id);
        if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
        if (!canSeeCollection(mrc, access.data)) return error("ไม่มีสิทธิ์อ่านรายการนี้", "PERMISSION_DENIED");
        const data = await repo.findSummaryForPrint(id, access.data);
        return data ? success(data) : error("ไม่พบรายการรวบรวมที่อ่านได้", "MRC_NOT_FOUND");
    },

    async list(
        criteria: MrcFilterCriteria, actorId: string,
    ): Promise<Result<PaginatedResult<MonthlyRequestCollectionWithRelations>>> {
        const access = await resolveCollectionReadAccess(actorId);
        if (!access.success) return access;
        return success(await repo.findMany(criteria, access.data));
    },

    async listEligibleExpenseClaims(
        month: Date,
        existingMrcId?: string
    ): Promise<Result<EligibleExpenseClaimForCollection[]>> {
        const claims = await repo.findEligibleExpenseClaimsForMonth(month, existingMrcId);
        return success(claims);
    },

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    /**
     * Admin creates a new MRC for a given month (DRAFT status).
     * Immediately associates the chosen expense claims and sets them to COLLECTED.
     */
    async create(
        data: CreateMrcInput,
        actorId: string
    ): Promise<Result<MonthlyRequestCollectionEntity>> {
        if (!data.expenseClaimIds || data.expenseClaimIds.length === 0) {
            return error("Please select at least one expense claim to collect", "NO_CLAIMS_SELECTED");
        }

        const month = normalizeMonth(data.collectForMonth);

        // Guard: only one active (non-CANCELLED) MRC is allowed per month
        const hasActive = await repo.findActiveForMonth(month);
        if (hasActive) {
            return error(
                "มีรายการรวบรวมคำขอรายเดือนที่ยังดำเนินการอยู่สำหรับเดือนนี้แล้ว — กรุณายกเลิกหรือรอให้รายการเดิมเสร็จสิ้นก่อน",
                "MRC_MONTH_CONFLICT"
            );
        }

        const mrc = await repo.create({ collectForMonth: month, expenseClaimIds: data.expenseClaimIds }, actorId);
        const linked = await repo.setExpenseClaims(mrc.id, data.expenseClaimIds);
        if (!linked.success) return linked;

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${mrc.id}" created`,
            targetEntityType: "MonthlyRequestCollection",
            targetEntityId: mrc.id,
            newData: { month: month.toISOString(), claimsCount: data.expenseClaimIds.length } as JsonValue,
        });

        return success(linked.data, "Monthly request collection created");
    },

    /**
     * Admin updates (replaces) the linked expense claims while still in DRAFT.
     */
    async update(
        id: string,
        data: UpdateMrcInput,
        actorId: string
    ): Promise<Result<MonthlyRequestCollectionEntity>> {
        const mrc = await repo.findById(id);
        if (!mrc) return error("Monthly request collection not found", "MRC_NOT_FOUND");

        if (mrc.status !== "DRAFT") {
            return error("Only a DRAFT collection can be edited", "MRC_NOT_DRAFT");
        }

        if (data.expenseClaimIds !== undefined) {
            if (data.expenseClaimIds.length === 0) {
                return error("Please select at least one expense claim", "NO_CLAIMS_SELECTED");
            }
            const linked = await repo.setExpenseClaims(id, data.expenseClaimIds);
            if (!linked.success) return linked;
        }

        const updated = await repo.findById(id);

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${id}" updated`,
            targetEntityType: "MonthlyRequestCollection",
            targetEntityId: id,
            newData: data as unknown as JsonValue,
        });

        return success(updated!, "Monthly request collection updated");
    },

    /** Submit once, creating the single HPA step atomically. */
    async submit(id: string, actorId: string): Promise<Result<MonthlyRequestCollectionEntity>> {
        let result: Result<MonthlyRequestCollectionEntity>;
        try {
            result = await repo.submitForReview(id);
        } catch {
            return error("ไม่สามารถส่งรายการได้ กรุณาลองใหม่", "MRC_UPDATE_FAILED");
        }
        if (!result.success) return result;
        await actionLogService.log({
            userId: actorId, actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${id}" submitted for HPA approval`,
            targetEntityType: "MonthlyRequestCollection", targetEntityId: id,
            previousData: { status: "DRAFT" }, newData: { status: "PENDING" },
        });
        const mrc = await repo.findWithRelations(id);
        void permissionRepository.findUserIdsByPermissionCode("monthly-request:review:hpa").then((hpaIds) => notificationService.sendToMany(
            [...new Set([result.data.collectorId, ...(mrc?.expenseClaims.map((c) => c.userId) ?? []), ...hpaIds])],
            "MRC_SUBMITTED", "มีรายการรวบรวมรายเดือนรอ หผ. อนุมัติ",
            "กรุณาตรวจสอบและลงนามรายงานรวบรวมรายเดือน", "/dashboard?tab=monthly-requests",
        )).catch(() => undefined);
        return result;
    },

    async reviewStep(
        id: string, input: ReviewMrcStepInput, actorId: string,
    ): Promise<Result<MonthlyRequestCollectionEntity>> {
        if (!input || input.stage !== "HPA_CHECK") return error("รองรับเฉพาะการอนุมัติของ หผ.", "INVALID_APPROVAL_STAGE");
        if (typeof input.approved !== "boolean" || (input.remark !== undefined && typeof input.remark !== "string")) {
            return error("ข้อมูลการอนุมัติไม่ถูกต้อง", "INVALID_REVIEW_INPUT");
        }
        if (!(await hasRole(actorId, "super-admin")) && !(await canExact(actorId, "MONTHLY_REQUEST", "REVIEW_HPA"))) {
            return error("ไม่มีสิทธิ์ในขั้นตอนนี้", "PERMISSION_DENIED");
        }
        const mrc = await repo.findWithRelations(id);
        if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
        let result: Result<MonthlyRequestCollectionEntity>;
        try {
            result = await repo.reviewCollection(id, input, actorId);
        } catch {
            return error("ไม่สามารถบันทึกการอนุมัติได้ กรุณาลองใหม่", "MRC_UPDATE_FAILED");
        }
        if (!result.success) return result;
        await actionLogService.log({
            userId: actorId, actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${id}" ${input.approved ? "approved and signed by HPA" : "rejected by HPA"}`,
            targetEntityType: "MonthlyRequestCollection", targetEntityId: id,
            previousData: { status: "PENDING" },
            newData: { stage: "HPA_CHECK", status: result.data.status, remark: input.remark ?? null },
        });
        void notificationService.sendToMany(
            [...new Set([mrc.collectorId, ...mrc.expenseClaims.map((c) => c.userId)])],
            input.approved ? "MRC_APPROVED" : "MRC_REJECTED",
            input.approved ? "รายงานรวบรวมรายเดือนได้รับการอนุมัติแล้ว" : "รายงานรวบรวมรายเดือนถูกปฏิเสธ",
            input.approved ? "หผ. ลงนามแล้ว ผู้รวบรวมสามารถพิมพ์/PDF เพื่อนำส่งในระบบเอกสารขององค์กร"
                : "หผ. ปฏิเสธรายงาน เอกสารเบิกที่เกี่ยวข้องกลับสู่สถานะรอรวบรวม",
            "/dashboard?tab=monthly-requests",
        ).catch(() => undefined);
        return result;
    },

    /** Parent-row lock serializes cancellation with submission and signing. */
    async cancel(id: string, actorId: string): Promise<Result<void>> {
        const mrc = await repo.findWithRelations(id);
        if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
        let result: Result<MonthlyRequestCollectionEntity>;
        try {
            result = await repo.cancelCollection(id);
        } catch {
            return error("ไม่สามารถยกเลิกรายการได้ กรุณาลองใหม่", "MRC_UPDATE_FAILED");
        }
        if (!result.success) return result;
        await actionLogService.log({
            userId: actorId, actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${id}" cancelled`,
            targetEntityType: "MonthlyRequestCollection", targetEntityId: id,
            previousData: { status: mrc.status }, newData: { status: "CANCELLED" },
        });
        void notificationService.sendToMany(
            [...new Set([mrc.collectorId, ...mrc.expenseClaims.map((c) => c.userId)])],
            "MRC_CANCELLED", "รายการรวบรวมรายเดือนถูกยกเลิก",
            "เอกสารเบิกที่เกี่ยวข้องกลับสู่สถานะรอรวบรวม", "/dashboard?tab=monthly-requests",
        ).catch(() => undefined);
        return success(undefined, "ยกเลิกรายการรวบรวมแล้ว");
    },
};
