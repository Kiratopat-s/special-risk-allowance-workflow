/**
 * MonthlyRequestCollection Domain - Service Layer
 *
 * Business logic and state-machine for the full MRC approval lifecycle.
 *
 * Status flow:
 *   DRAFT  ──(submit)──► PENDING  ──(HPA approve)──► PENDING
 *          ──(HPA reject)──► REJECTED
 *          ──(RK approve)──► PENDING
 *          ──(RK reject)──► REJECTED
 *          ──(OK approve)──► APPROVED  (expense claims set to APPROVED)
 *          ──(OK reject)──► REJECTED
 *   DRAFT/PENDING (no APPROVED steps) ──(cancel)──► CANCELLED
 *
 * @module lib/domains/monthly-request-collection/service
 */

import { monthlyRequestCollectionRepository as repo } from "./repository";
import { permissionRepository } from "@/lib/domains/permission/repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { notificationService } from "@/lib/domains/notification";
import { ActionType } from "@/lib/shared/types";
import { success, error, type Result } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/shared/types";
import type {
    MonthlyRequestCollectionEntity,
    MonthlyRequestCollectionWithRelations,
    CreateMrcInput,
    UpdateMrcInput,
    ReviewMrcStepInput,
    MrcFilterCriteria,
    EligibleExpenseClaimForCollection,
} from "./types";

type JsonValue = Prisma.JsonValue;

// Linear sequence of approval stages used by the reviewStep logic to determine
// the current position in the multi-level workflow and which role should act next.
// Changing this order will directly affect the progression of approvals.
const STAGE_ORDER = ["HPA_CHECK", "RK_CHECK", "OK_APPROVE"] as const;

function normalizeMonth(value: Date | string): Date {
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export const monthlyRequestCollectionService = {
    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    async getById(id: string): Promise<Result<MonthlyRequestCollectionWithRelations>> {
        const mrc = await repo.findWithRelations(id);
        if (!mrc) return error("Monthly request collection not found", "MRC_NOT_FOUND");
        return success(mrc);
    },

    async list(
        criteria: MrcFilterCriteria
    ): Promise<Result<PaginatedResult<MonthlyRequestCollectionWithRelations>>> {
        const result = await repo.findMany(criteria);
        return success(result);
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
        await repo.setExpenseClaims(mrc.id, data.expenseClaimIds);

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${mrc.id}" created`,
            targetEntityType: "MonthlyRequestCollection",
            targetEntityId: mrc.id,
            newData: { month: month.toISOString(), claimsCount: data.expenseClaimIds.length } as JsonValue,
        });

        return success(mrc, "Monthly request collection created");
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
            await repo.setExpenseClaims(id, data.expenseClaimIds);
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

    /**
     * Admin submits a DRAFT collection — creates the first approval step (HPA_CHECK).
     */
    async submit(id: string, actorId: string): Promise<Result<MonthlyRequestCollectionEntity>> {
        const mrc = await repo.findById(id);
        if (!mrc) return error("Monthly request collection not found", "MRC_NOT_FOUND");

        if (mrc.status !== "DRAFT") {
            return error("Only a DRAFT collection can be submitted", "MRC_NOT_DRAFT");
        }

        await repo.updateStatus(id, "PENDING");
        await repo.createApprovalStep(id, "HPA_CHECK");

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${id}" submitted for HPA review`,
            targetEntityType: "MonthlyRequestCollection",
            targetEntityId: id,
            previousData: { status: "DRAFT" } as JsonValue,
            newData: { status: "PENDING" } as JsonValue,
        });

        const updated = await repo.findById(id);

        // Notify HPA reviewers that a new MRC needs their review
        void permissionRepository.findUserIdsByPermissionCode("monthly-request:review:hpa").then(
            (hpaIds) => {
                if (hpaIds.length > 0) {
                    notificationService.sendToMany(
                        hpaIds,
                        "MRC_SUBMITTED",
                        "มีรายการรวบรวมคำขอรายเดือนรอการตรวจสอบ",
                        "มีรายการรวบรวมคำขอรายเดือนใหม่รอการตรวจสอบในขั้นตอน HPA",
                        "/monthly-request-collection"
                    );
                }
            }
        );

        return success(updated!, "Submitted for review");
    },

    /**
     * A reviewer (หผ/รก/อก) reviews the current pending approval step.
     *
     * - Approved + not last stage → advance to next stage (create next PENDING step)
     * - Approved + last stage (OK_APPROVE) → set MRC to APPROVED, update linked expense claims to APPROVED
     * - Rejected → set MRC to REJECTED, revert linked expense claims to PENDING
     */
    async reviewStep(
        id: string,
        input: ReviewMrcStepInput,
        actorId: string
    ): Promise<Result<MonthlyRequestCollectionEntity>> {
        const mrc = await repo.findWithRelations(id);
        if (!mrc) return error("Monthly request collection not found", "MRC_NOT_FOUND");

        if (mrc.status !== "PENDING") {
            return error("Only a PENDING collection can be reviewed", "MRC_NOT_PENDING");
        }

        // Verify the step exists and is PENDING
        const step = await repo.findApprovalStep(id, input.stage);
        if (!step || step.status !== "PENDING") {
            return error(
                "This review step is not currently open for action",
                "STEP_NOT_PENDING"
            );
        }

        const newStepStatus = input.approved ? "APPROVED" : "REJECTED";
        await repo.reviewApprovalStep(id, input.stage, newStepStatus, actorId, input.remark);

        if (!input.approved) {
            // Rejection → MRC REJECTED, revert claims to PENDING
            await repo.updateStatus(id, "REJECTED");
            await repo.bulkUpdateLinkedClaimsStatus(id, "PENDING");

            await actionLogService.log({
                userId: actorId,
                actionType: ActionType.OTHER,
                actionDescription: `Monthly request collection "${id}" rejected at stage ${input.stage}`,
                targetEntityType: "MonthlyRequestCollection",
                targetEntityId: id,
                newData: { stage: input.stage, status: "REJECTED", remark: input.remark } as JsonValue,
            });

            // Notify collector + all claimants of rejection
            const claimantIds = [...new Set(mrc.expenseClaims.map((c) => c.userId))];
            void notificationService.sendToMany(
                [...new Set([mrc.collectorId, ...claimantIds])],
                "MRC_REJECTED",
                "คำขอรายเดือนถูกปฏิเสธ",
                `รายการรวบรวมคำขอรายเดือนถูกปฏิเสธในขั้นตอน ${input.stage}`,
                "/monthly-request-collection"
            );

            const updated = await repo.findById(id);
            return success(updated!, "Rejected successfully");
        }

        // Approved — advance or finalise
        const currentIndex = STAGE_ORDER.indexOf(input.stage as typeof STAGE_ORDER[number]);
        const isLastStage = currentIndex === STAGE_ORDER.length - 1;

        if (isLastStage) {
            // Final approval
            await repo.updateStatus(id, "APPROVED");
            await repo.bulkUpdateLinkedClaimsStatus(id, "APPROVED");

            await actionLogService.log({
                userId: actorId,
                actionType: ActionType.OTHER,
                actionDescription: `Monthly request collection "${id}" fully approved`,
                targetEntityType: "MonthlyRequestCollection",
                targetEntityId: id,
                newData: { stage: input.stage, status: "APPROVED" } as JsonValue,
            });

            // Notify collector + all claimants of final approval
            const claimantIds = [...new Set(mrc.expenseClaims.map((c) => c.userId))];
            void notificationService.sendToMany(
                [...new Set([mrc.collectorId, ...claimantIds])],
                "MRC_APPROVED",
                "คำขอรายเดือนได้รับการอนุมัติแล้ว",
                "รายการรวบรวมคำขอรายเดือนได้รับการอนุมัติครบทุกขั้นตอนแล้ว",
                "/monthly-request-collection"
            );
        } else {
            // Advance to next stage — notify the next-stage reviewers
            const nextStage = STAGE_ORDER[currentIndex + 1];
            await repo.createApprovalStep(id, nextStage);

            await actionLogService.log({
                userId: actorId,
                actionType: ActionType.OTHER,
                actionDescription: `Monthly request collection "${id}" approved at ${input.stage}, advancing to ${nextStage}`,
                targetEntityType: "MonthlyRequestCollection",
                targetEntityId: id,
                newData: { stage: input.stage, nextStage } as JsonValue,
            });

            const stagePermCode =
                nextStage === "RK_CHECK" ? "monthly-request:review:rk" : "monthly-request:review:ok";
            void permissionRepository.findUserIdsByPermissionCode(stagePermCode).then(
                (nextReviewerIds) => notificationService.sendToMany(
                    [...new Set([mrc.collectorId, ...nextReviewerIds])],
                    "MRC_STEP_APPROVED",
                    "ขั้นตอนการอนุมัติผ่านแล้ว — รอดำเนินการขั้นถัดไป",
                    `คำขอรายเดือนผ่านขั้น ${input.stage} แล้ว กรุณาดำเนินการในขั้นตอน ${nextStage}`,
                    "/monthly-request-collection"
                )
            );
        }

        const updated = await repo.findById(id);
        return success(updated!, isLastStage ? "Fully approved" : "Step approved, advanced to next stage");
    },

    /**
     * Admin cancels a collection.
     * Allowed only when status=DRAFT or status=PENDING with no APPROVED steps.
     * Reverts linked expense claims to WAIT_FOR_COLLECTION and unlinks them
     * from the MRC so admin can collect them again in a future MRC.
     */
    async cancel(id: string, actorId: string): Promise<Result<void>> {
        const mrc = await repo.findWithRelations(id);
        if (!mrc) return error("Monthly request collection not found", "MRC_NOT_FOUND");

        if (mrc.status === "CANCELLED") return error("Already cancelled", "MRC_ALREADY_CANCELLED");
        if (mrc.status === "APPROVED") return error("An approved collection cannot be cancelled", "MRC_APPROVED");

        const hasApprovedStep = mrc.approvalSteps.some((s) => s.status === "APPROVED");
        if (hasApprovedStep) {
            return error(
                "Cannot cancel: a reviewer has already approved this collection",
                "MRC_STEP_ALREADY_APPROVED"
            );
        }

        await repo.updateStatus(id, "CANCELLED", new Date());
        await repo.rollbackLinkedClaimsOnCancel(id);

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Monthly request collection "${id}" cancelled`,
            targetEntityType: "MonthlyRequestCollection",
            targetEntityId: id,
            previousData: { status: mrc.status } as JsonValue,
            newData: { status: "CANCELLED" } as JsonValue,
        });

        // Notify collector + all claimants — their ECDs have been returned to WAIT_FOR_COLLECTION
        const claimantIds = [...new Set(mrc.expenseClaims.map((c) => c.userId))];
        void notificationService.sendToMany(
            [...new Set([mrc.collectorId, ...claimantIds])],
            "MRC_CANCELLED",
            "รายการรวบรวมคำขอรายเดือนถูกยกเลิก",
            "รายการรวบรวมคำขอรายเดือนถูกยกเลิกแล้ว เอกสารเบิกจ่ายที่เกี่ยวข้องกลับสู่สถานะรอรวบรวม",
            "/monthly-request-collection"
        );

        return success(undefined, "Monthly request collection cancelled");
    },
};
