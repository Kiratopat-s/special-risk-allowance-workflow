/**
 * ExpenseClaimDocument Domain - Service Layer
 *
 * Business logic layer for expense claim document operations
 *
 * @module lib/domains/expense-claim-document/service
 */

import { expenseClaimDocumentRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { leaderVerificationService } from "@/lib/domains/leader-verification";
import { leaderVerificationRepository } from "@/lib/domains/leader-verification/repository";
import { prisma } from "@/lib/db";
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

function normalizeMonth(value: Date | string): Date {
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const expenseClaimDocumentService = {
    /**
     * List eligible off-site works for claim creation
     */
    async listEligibleOffSiteWorksForUser(
        userId: string,
        month: Date
    ): Promise<Result<EligibleOffSiteWorkOption[]>> {
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
        if (!data.claimantPositionAtSubmission?.trim()) {
            return error(
                "Claimant position at submission is required",
                "MISSING_CLAIMANT_POSITION"
            );
        }

        if (data.selectedDates) {
            const invalidDate = data.selectedDates.find((date) => !isIsoDate(date));
            if (invalidDate) {
                return error(
                    `Invalid selected date format: ${invalidDate}`,
                    "INVALID_SELECTED_DATES"
                );
            }
        }

        const normalizedMonth = normalizeMonth(data.expenseMonth);

        // Guard: when submitting (not draft), every linked OSW must have a leader assigned.
        if (
            data.status !== "DRAFT" &&
            data.offSiteWorkIds &&
            data.offSiteWorkIds.length > 0
        ) {
            const linkedOsws = await prisma.offSiteWork.findMany({
                where: { id: { in: data.offSiteWorkIds }, deletedAt: null },
                select: { id: true, innerRefDocumentId: true, leaderUserId: true, leaderEmail: true },
            });
            const noLeader = linkedOsws.filter(
                (o) => !o.leaderUserId && !o.leaderEmail
            );
            if (noLeader.length > 0) {
                const refs = noLeader
                    .map((o) => o.innerRefDocumentId ?? o.id)
                    .join(", ");
                return error(
                    `ใบสั่งปฏิบัติงานต่อไปนี้ยังไม่มีการกำหนดหัวหน้า: ${refs} — กรุณากำหนดหัวหน้าก่อนส่งเอกสาร`,
                    "OSW_MISSING_LEADER"
                );
            }
        }

        const claim = await expenseClaimDocumentRepository.create(
            {
                ...data,
                expenseMonth: normalizedMonth,
            },
            targetUserId,
            actorId
        );

        // If any linked OSW has a leader, create verification records
        if (data.offSiteWorkIds && data.offSiteWorkIds.length > 0) {
            const verifications = await leaderVerificationService.createForClaim(
                claim.id,
                data.offSiteWorkIds
            );
            if (verifications.length > 0) {
                await expenseClaimDocumentRepository.updateStatus(
                    claim.id,
                    "PENDING_LEADER_VERIFY"
                );
                // Re-fetch with updated status
                const updated = await expenseClaimDocumentRepository.findById(claim.id);
                await actionLogService.log({
                    userId: actorId,
                    actionType: ActionType.OTHER,
                    actionDescription: `Expense claim "${claim.id}" created`,
                    targetEntityType: "ExpenseClaim",
                    targetEntityId: claim.id,
                    newData: {
                        id: claim.id,
                        userId: claim.userId,
                        expenseMonth: claim.expenseMonth.toISOString(),
                        status: "PENDING_LEADER_VERIFY",
                    } as unknown as JsonValue,
                    ...context,
                });
                return success(updated!, "Expense claim document created successfully");
            }
        }

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${claim.id}" created`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: claim.id,
            newData: {
                id: claim.id,
                userId: claim.userId,
                expenseMonth: claim.expenseMonth.toISOString(),
                status: claim.status,
            } as unknown as JsonValue,
            ...context,
        });

        return success(claim, "Expense claim document created successfully");
    },

    /**
     * Update an existing claim document
     */
    async update(
        id: string,
        data: UpdateExpenseClaimDocumentInput,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<ExpenseClaimDocumentEntity>> {
        const existing = await expenseClaimDocumentRepository.findById(id);

        if (!existing) {
            return error("Expense claim document not found", "CLAIM_NOT_FOUND");
        }

        if (existing.status === "CANCELLED") {
            return error(
                "Cannot edit a cancelled expense claim document",
                "CLAIM_CANCELLED"
            );
        }

        if (data.selectedDates) {
            const invalidDate = data.selectedDates.find((date) => !isIsoDate(date));
            if (invalidDate) {
                return error(
                    `Invalid selected date format: ${invalidDate}`,
                    "INVALID_SELECTED_DATES"
                );
            }
        }

        const updatePayload: UpdateExpenseClaimDocumentInput = {
            ...data,
            ...(data.expenseMonth
                ? { expenseMonth: normalizeMonth(data.expenseMonth) }
                : {}),
        };

        const updated = await expenseClaimDocumentRepository.update(id, updatePayload);

        // Recalculate leader verifications if offSiteWorkIds changed
        if (data.offSiteWorkIds !== undefined) {
            // Always clear existing verifications first
            await leaderVerificationRepository.deleteAllByClaimId(id);

            if (existing.status !== "DRAFT") {
                // For non-DRAFT documents: re-create verifications and auto-transition status
                if (data.offSiteWorkIds.length > 0) {
                    const verifications = await leaderVerificationService.createForClaim(
                        id,
                        data.offSiteWorkIds
                    );
                    if (verifications.length > 0) {
                        await expenseClaimDocumentRepository.updateStatus(
                            id,
                            "PENDING_LEADER_VERIFY"
                        );
                    } else if (
                        existing.status === "PENDING_LEADER_VERIFY" ||
                        existing.status === "WAIT_FOR_COLLECTION"
                    ) {
                        // No leaders anymore — revert to PENDING
                        await expenseClaimDocumentRepository.updateStatus(id, "PENDING");
                    }
                } else if (
                    existing.status === "PENDING_LEADER_VERIFY" ||
                    existing.status === "WAIT_FOR_COLLECTION"
                ) {
                    // OSWs cleared — revert to PENDING
                    await expenseClaimDocumentRepository.updateStatus(id, "PENDING");
                }
            }
            // For DRAFT: verifications cleared, OSW links updated by repository update above.
            // Status stays DRAFT — verifications are created later when submitDraft is called.
        }

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" updated`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: id,
            previousData: {
                expenseMonth: existing.expenseMonth.toISOString(),
                status: existing.status,
                remark: existing.remark,
            } as unknown as JsonValue,
            newData: data as unknown as JsonValue,
            ...context,
        });

        return success(updated, "Expense claim document updated successfully");
    },

    /**
     * Submit a DRAFT claim document.
     * Checks that all linked OSWs have leaders, creates verification records,
     * and transitions status to PENDING_LEADER_VERIFY (or PENDING if no OSWs).
     */
    async submitDraft(
        id: string,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<ExpenseClaimDocumentEntity>> {
        const claim = await expenseClaimDocumentRepository.findWithRelations(id);

        if (!claim) {
            return error("Expense claim document not found", "CLAIM_NOT_FOUND");
        }

        if (claim.status !== "DRAFT") {
            return error(
                `ไม่สามารถส่งเอกสารที่ไม่อยู่ในสถานะร่าง (สถานะปัจจุบัน: ${claim.status})`,
                "INVALID_STATUS"
            );
        }

        if (claim.userId !== actorId) {
            return error("คุณไม่มีสิทธิ์ส่งเอกสารนี้", "FORBIDDEN");
        }

        // Guard: all linked OSWs must have a leader
        const leaderlessLinks = claim.expenseClaimOffSiteWorks.filter(
            (l) => !l.offSiteWork.leaderUserId && !l.offSiteWork.leaderEmail
        );
        if (leaderlessLinks.length > 0) {
            const refs = leaderlessLinks
                .map((l) => l.offSiteWork.innerRefDocumentId ?? l.offSiteWork.id)
                .join(", ");
            return error(
                `ใบสั่งปฏิบัติงานต่อไปนี้ยังไม่มีการกำหนดหัวหน้า: ${refs} — กรุณากำหนดหัวหน้าก่อนส่งเอกสาร`,
                "OSW_MISSING_LEADER"
            );
        }

        const offSiteWorkIds = claim.expenseClaimOffSiteWorks.map(
            (l) => l.offSiteWorkId
        );

        let newStatus: "PENDING_LEADER_VERIFY" | "PENDING" = "PENDING";
        if (offSiteWorkIds.length > 0) {
            const verifications = await leaderVerificationService.createForClaim(
                id,
                offSiteWorkIds
            );
            if (verifications.length > 0) {
                newStatus = "PENDING_LEADER_VERIFY";
            }
        }

        await expenseClaimDocumentRepository.updateStatus(id, newStatus);

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" submitted from DRAFT`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: id,
            previousData: { status: "DRAFT" } as unknown as JsonValue,
            newData: { status: newStatus } as unknown as JsonValue,
            ...context,
        });

        const updated = await expenseClaimDocumentRepository.findById(id);
        return success(updated!, "Expense claim document submitted successfully");
    },

    /**
     * Soft-delete a claim document by cancellation
     */
    async delete(
        id: string,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<void>> {
        const existing = await expenseClaimDocumentRepository.findById(id);

        if (!existing) {
            return error("Expense claim document not found", "CLAIM_NOT_FOUND");
        }

        if (existing.status === "APPROVED") {
            return error(
                "Approved expense claim cannot be cancelled",
                "CLAIM_ALREADY_APPROVED"
            );
        }

        if (existing.status === "CANCELLED") {
            return error("Expense claim already cancelled", "CLAIM_CANCELLED");
        }

        await expenseClaimDocumentRepository.softDelete(id);

        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.OTHER,
            actionDescription: `Expense claim "${id}" cancelled`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: id,
            previousData: {
                status: existing.status,
                cancelledAt: existing.cancelledAt,
            } as unknown as JsonValue,
            ...context,
        });

        return success(undefined, "Expense claim document cancelled successfully");
    },

    /**
     * List claim documents with filters
     */
    async list(
        criteria: ExpenseClaimDocumentFilterCriteria
    ): Promise<Result<PaginatedResult<ExpenseClaimDocumentWithRelations>>> {
        const result = await expenseClaimDocumentRepository.findMany(criteria);
        return success(result);
    },
};

