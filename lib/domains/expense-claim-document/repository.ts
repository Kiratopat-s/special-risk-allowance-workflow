/**
 * ExpenseClaimDocument Domain - Repository Layer
 *
 * Data access layer for expense claim documents
 *
 * @module lib/domains/expense-claim-document/repository
 */

import { claimWhere, claimOrderBy } from "./read-query";
import { claimSelectionChanged, normalizeClaimSelection, requireEditableClaim, type ClaimSelection } from "./claim-selection";
import { claimPrintSelect } from "./print-data";
import { prisma } from "@/lib/db";
import { Prisma, type ClaimDocumentStatus } from "@/lib/generated/prisma/client";
import { sanitizeStrings } from "@/lib/shared/sanitize";
import { success, error, type Result } from "@/lib/shared/types";
import { captureSubmissionDepartment, isSubmittedClaimStatus, lockClaim, needsDepartmentSnapshot } from "./department-snapshot";
import type {
    ExpenseClaimDocumentEntity,
    ExpenseClaimDocumentWithRelations,
    CreateExpenseClaimDocumentInput,
    UpdateExpenseClaimDocumentInput,
    ExpenseClaimDocumentFilterCriteria,
    EligibleOffSiteWorkOption,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

const userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    employeeId: true,
    departmentId: true,
} as const;

const createdBySelect = {
    id: true,
    firstName: true,
    lastName: true,
    employeeId: true,
} as const;

const offSiteWorkSelect = {
    id: true,
    innerRefDocumentId: true,
    startDate: true,
    endDate: true,
    location: true,
    objective: true,
    leaderUserId: true,
    leaderEmpId: true,
    leaderFirstName: true,
    leaderLastName: true,
    leaderPosition: true,
    leaderEmail: true,
} as const;

const leaderVerificationSelect = {
    id: true,
    offSiteWorkId: true,
    leaderUserId: true,
    leaderEmail: true,
    token: true,
    expiresAt: true,
    verifiedAt: true,
} as const;

function serializeDecimalFields<T extends { countDates: unknown; amount: unknown }>(
    item: T
): T {
    return {
        ...item,
        countDates: item.countDates != null ? Number(item.countDates) : null,
        amount: item.amount != null ? Number(item.amount) : null,
    };
}

export interface ClaimMutationOutcome {
    claim: ExpenseClaimDocumentEntity;
    previous: ExpenseClaimDocumentEntity | null;
    verificationsReset: boolean;
}

async function prepareSelection(
    tx: Prisma.TransactionClient,
    userId: string,
    input: { expenseMonth: Date | string; selectedDates?: unknown; offSiteWorkIds?: unknown },
    submitted: boolean,
): Promise<Result<ClaimSelection>> {
    const month = new Date(input.expenseMonth);
    if (!Number.isFinite(month.getTime())) return error("เดือนที่ขอเบิกไม่ถูกต้อง", "INVALID_EXPENSE_MONTH");
    const eligible = await expenseClaimDocumentRepository.findEligibleOffSiteWorksForUser(userId, month, tx);
    return normalizeClaimSelection(input, eligible, submitted);
}

async function verificationInputs(tx: Prisma.TransactionClient, offSiteWorkIds: string[]) {
    const works = await tx.offSiteWork.findMany({
        where: { id: { in: offSiteWorkIds }, deletedAt: null },
        select: { id: true, leaderUserId: true, leaderEmail: true },
    });
    if (works.length !== offSiteWorkIds.length || works.some((work) => !work.leaderUserId && !work.leaderEmail)) {
        return error("กรุณากำหนดหัวหน้าให้ครบทุกใบสั่งปฏิบัติงานก่อนส่งเอกสาร", "OSW_MISSING_LEADER");
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return success(works.map((work) => ({
        offSiteWorkId: work.id, leaderUserId: work.leaderUserId, leaderEmail: work.leaderEmail, expiresAt,
    })));
}

function hasWorkflowFields(data: UpdateExpenseClaimDocumentInput): boolean {
    return data.status !== undefined || data.monthlyRequestCollectionId !== undefined || data.collectedAt !== undefined;
}

/** Read, validate and replace content/verification requests while holding one claim lock. */
async function saveEditableSelection(
    id: string,
    data: UpdateExpenseClaimDocumentInput,
    submitterId?: string,
): Promise<Result<ClaimMutationOutcome>> {
    if (hasWorkflowFields(data)) return error("ไม่สามารถเปลี่ยนสถานะหรือรายการรวบรวมผ่านการแก้ไขเอกสาร", "INVALID_CLAIM_UPDATE");
    data = sanitizeStrings(data);
    return prisma.$transaction(async (tx) => {
        const existing = await lockClaim(tx, id);
        if (!existing) return error("Expense claim document not found", "CLAIM_NOT_FOUND");
        const editable = requireEditableClaim(existing);
        if (!editable.success) return editable;
        if (submitterId !== undefined) {
            if (existing.status !== "DRAFT") return error("เอกสารนี้ไม่ได้อยู่ในสถานะร่างแล้ว", "INVALID_STATUS");
            if (existing.userId !== submitterId) return error("คุณไม่มีสิทธิ์ส่งเอกสารนี้", "FORBIDDEN");
        }
        const links = await tx.expenseClaimOffSiteWork.findMany({ where: { expenseClaimId: id }, select: { offSiteWorkId: true } });
        const submitted = submitterId !== undefined || existing.status !== "DRAFT";
        const selection = await prepareSelection(tx, existing.userId, {
            expenseMonth: data.expenseMonth ?? existing.expenseMonth,
            selectedDates: data.selectedDates === undefined ? existing.selectedDates : data.selectedDates,
            offSiteWorkIds: data.offSiteWorkIds ?? links.map((link) => link.offSiteWorkId),
        }, submitted);
        if (!selection.success) return selection;
        const position = data.claimantPositionAtSubmission ?? existing.claimantPositionAtSubmission;
        if (!position.trim()) return error("กรุณาระบุตำแหน่งผู้ยื่นเอกสาร", "MISSING_CLAIMANT_POSITION");
        const changed = claimSelectionChanged({ ...existing, offSiteWorkIds: links.map((link) => link.offSiteWorkId) }, selection.data);
        const resetVerifications = submitterId !== undefined || changed;
        const nextStatus = submitterId !== undefined || (submitted && changed)
            ? "PENDING_LEADER_VERIFY" : existing.status;
        const records = submitted && resetVerifications
            ? await verificationInputs(tx, selection.data.offSiteWorkIds) : success([]);
        if (!records.success) return records;
        const snapshot = needsDepartmentSnapshot(existing, nextStatus)
            ? await captureSubmissionDepartment(tx, existing.userId) : {};
        if (resetVerifications) await tx.leaderVerification.deleteMany({ where: { expenseClaimId: id } });
        const { offSiteWorkIds, ...dateFields } = selection.data;
        const claim = await tx.expenseClaim.update({
            where: { id }, data: {
                ...dateFields, ...snapshot, status: nextStatus,
                claimantPositionAtSubmission: position,
                ...(data.remark !== undefined ? { remark: data.remark } : {}),
                ...(changed ? { expenseClaimOffSiteWorks: {
                    deleteMany: {}, create: offSiteWorkIds.map((offSiteWorkId) => ({ offSiteWorkId })),
                } } : {}),
                ...(records.data.length ? { leaderVerifications: { create: records.data } } : {}),
            },
        });
        return success({
            claim: serializeDecimalFields(claim) as ExpenseClaimDocumentEntity,
            previous: serializeDecimalFields(existing) as ExpenseClaimDocumentEntity,
            verificationsReset: submitted && resetVerifications,
        });
    });
}

export const expenseClaimDocumentRepository = {
    async createWithSelection(
        data: CreateExpenseClaimDocumentInput, userId: string, createdById: string,
    ): Promise<Result<ClaimMutationOutcome>> {
        const status = data.status ?? "DRAFT";
        if (!["DRAFT", "PENDING", "PENDING_LEADER_VERIFY"].includes(status) ||
            data.monthlyRequestCollectionId !== undefined || data.collectedAt !== undefined) {
            return error("สถานะเริ่มต้นของเอกสารไม่ถูกต้อง", "INVALID_STATUS");
        }
        data = sanitizeStrings(data);
        if (!data.claimantPositionAtSubmission?.trim()) return error("กรุณาระบุตำแหน่งผู้ยื่นเอกสาร", "MISSING_CLAIMANT_POSITION");
        return prisma.$transaction(async (tx) => {
            const submitted = status !== "DRAFT";
            const selection = await prepareSelection(tx, userId, data, submitted);
            if (!selection.success) return selection;
            const records = submitted ? await verificationInputs(tx, selection.data.offSiteWorkIds) : success([]);
            if (!records.success) return records;
            const snapshot = submitted ? await captureSubmissionDepartment(tx, userId) : {};
            const { offSiteWorkIds, ...dateFields } = selection.data;
            const claim = await tx.expenseClaim.create({ data: {
                ...dateFields, ...snapshot, userId, createdById,
                claimantPositionAtSubmission: data.claimantPositionAtSubmission,
                remark: data.remark, status: submitted ? "PENDING_LEADER_VERIFY" : "DRAFT",
                expenseClaimOffSiteWorks: { create: offSiteWorkIds.map((offSiteWorkId) => ({ offSiteWorkId })) },
                ...(records.data.length ? { leaderVerifications: { create: records.data } } : {}),
            } });
            return success({ claim: serializeDecimalFields(claim) as ExpenseClaimDocumentEntity, previous: null, verificationsReset: submitted });
        });
    },

    updateEditable(id: string, data: UpdateExpenseClaimDocumentInput): Promise<Result<ClaimMutationOutcome>> {
        return saveEditableSelection(id, data);
    },

    submitDraftWithSelection(id: string, actorId: string): Promise<Result<ClaimMutationOutcome>> {
        return saveEditableSelection(id, {}, actorId);
    },

    async cancelEditable(id: string): Promise<Result<ExpenseClaimDocumentEntity>> {
        return prisma.$transaction(async (tx) => {
            const existing = await lockClaim(tx, id);
            if (!existing) return error("Expense claim document not found", "CLAIM_NOT_FOUND");
            const editable = requireEditableClaim(existing);
            if (!editable.success) return editable;
            await tx.expenseClaim.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
            return success(serializeDecimalFields(existing) as ExpenseClaimDocumentEntity);
        });
    },

    async findForPrint(id: string, userId: string) {
        return prisma.expenseClaim.findFirst({
            where: { id, userId, cancelledAt: null, status: { not: "CANCELLED" } },
            select: claimPrintSelect,
        });
    },
    /**
     * Find off-site work options eligible for claim creation for a specific user.
     * - Related to user: posted by user OR listed in employee_list JSON
        * - Not already linked to any APPROVED expense claim of the same user in selected month
     * - Overlaps selected month range
     */
    async findEligibleOffSiteWorksForUser(
        userId: string,
        month: Date,
        client: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma,
    ): Promise<EligibleOffSiteWorkOption[]> {
        const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
        const monthEnd = new Date(
            Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 23, 59, 59, 999)
        );

        const rows = await client.$queryRaw<EligibleOffSiteWorkOption[]>`
			SELECT
				osw.id,
				osw.inner_ref_document_id AS "innerRefDocumentId",
				osw.start_date AS "startDate",
				osw.end_date AS "endDate",
				osw.location,
				osw.objective,
				(osw.leader_user_id IS NOT NULL OR osw.leader_email IS NOT NULL) AS "hasLeader",
				osw.leader_first_name AS "leaderFirstName",
				osw.leader_last_name AS "leaderLastName",
				osw.leader_email AS "leaderEmail"
			FROM off_site_works osw
			WHERE
				osw.deleted_at IS NULL
				AND osw.start_date <= ${monthEnd}
				AND osw.end_date >= ${monthStart}
				AND (
					osw.posted_by_user_id = ${userId}
					OR EXISTS (
						SELECT 1
						FROM jsonb_array_elements(COALESCE(osw.employee_list, '[]'::jsonb)) AS emp
						WHERE emp->>'userId' = ${userId}
					)
				)
				AND NOT EXISTS (
					SELECT 1
					FROM expense_claim_off_site_work ecosw
					JOIN expense_claims ec ON ec.id = ecosw.expense_claim_id
					WHERE ecosw.off_site_work_id = osw.id
						AND ec.user_id = ${userId}
						AND ec.status = 'APPROVED'
						AND ec.cancelled_at IS NULL
                        AND ec.expense_month >= ${monthStart}
                        AND ec.expense_month <= ${monthEnd}
				)
			ORDER BY osw.start_date DESC, osw.id DESC
		`;

        return rows;
    },

    /**
     * Find claim by ID (exclude cancelled by default)
     */
    async findById(
        id: string,
        includeCancelled = false
    ): Promise<ExpenseClaimDocumentEntity | null> {
        const result = await prisma.expenseClaim.findFirst({
            where: {
                id,
                ...(includeCancelled ? {} : { cancelledAt: null }),
            },
        });

        return result ? serializeDecimalFields(result as ExpenseClaimDocumentEntity) : null;
    },

    /**
     * Find claim by ID with relations
     */
    async findWithRelations(
        id: string,
        includeCancelled = false
    ): Promise<ExpenseClaimDocumentWithRelations | null> {
        const result = await prisma.expenseClaim.findFirst({
            where: {
                id,
                ...(includeCancelled ? {} : { cancelledAt: null }),
            },
            include: {
                claimant: { select: userSelect },
                createdBy: { select: createdBySelect },
                expenseClaimOffSiteWorks: {
                    select: {
                        offSiteWorkId: true,
                        offSiteWork: { select: offSiteWorkSelect },
                    },
                },
                leaderVerifications: { select: leaderVerificationSelect },
            },
        });

        return result ? serializeDecimalFields(result as ExpenseClaimDocumentWithRelations) : null;
    },

    /**
     * Update only the status field of a claim document
     */
    async updateStatus(
        id: string,
        status: ClaimDocumentStatus
    ): Promise<ExpenseClaimDocumentEntity> {
        return prisma.$transaction(async (tx) => {
            const existing = await lockClaim(tx, id);
            if (!existing) throw new Error("Expense claim document not found");
            const snapshot = needsDepartmentSnapshot(existing, status)
                ? await captureSubmissionDepartment(tx, existing.userId) : {};
            return serializeDecimalFields(await tx.expenseClaim.update({
                where: { id }, data: { status, ...snapshot },
            })) as ExpenseClaimDocumentEntity;
        });
    },

    /** Recheck the draft under lock before committing its first submission. */
    async submitDraft(
        id: string,
        status: "PENDING" | "PENDING_LEADER_VERIFY"
    ): Promise<Result<ExpenseClaimDocumentEntity>> {
        return prisma.$transaction(async (tx) => {
            const existing = await lockClaim(tx, id);
            if (!existing) return error("Expense claim document not found", "CLAIM_NOT_FOUND");
            if (existing.status !== "DRAFT" || existing.cancelledAt !== null) {
                return error("เอกสารนี้ไม่ได้อยู่ในสถานะร่างแล้ว", "INVALID_STATUS");
            }
            const snapshot = needsDepartmentSnapshot(existing, status)
                ? await captureSubmissionDepartment(tx, existing.userId) : {};
            const updated = await tx.expenseClaim.update({ where: { id }, data: { status, ...snapshot } });
            return success(serializeDecimalFields(updated) as ExpenseClaimDocumentEntity);
        });
    },

    /**
     * Create a new claim document
     */
    async create(
        data: CreateExpenseClaimDocumentInput,
        userId: string,
        createdById: string
    ): Promise<ExpenseClaimDocumentEntity> {
        // Strip null bytes (0x00) from all string fields — PostgreSQL rejects them
        data = sanitizeStrings(data);

        const createData = {
            expenseMonth: new Date(data.expenseMonth),
            userId,
            claimantPositionAtSubmission: data.claimantPositionAtSubmission,
            selectedDates: (data.selectedDates ?? Prisma.JsonNull) as unknown,
            countDates: data.countDates,
            amount: data.amount,
            remark: data.remark,
            createdById,
            status: data.status,
            monthlyRequestCollectionId: data.monthlyRequestCollectionId,
            collectedAt: data.collectedAt ? new Date(data.collectedAt) : undefined,
            ...(data.offSiteWorkIds && data.offSiteWorkIds.length > 0
                ? {
                    expenseClaimOffSiteWorks: {
                        create: data.offSiteWorkIds.map((offSiteWorkId) => ({
                            offSiteWorkId,
                        })),
                    },
                }
                : {}),
        };

        return prisma.$transaction(async (tx) => {
            const snapshot = isSubmittedClaimStatus(data.status ?? "DRAFT")
                ? await captureSubmissionDepartment(tx, userId) : {};
            const created = await tx.expenseClaim.create({
                data: { ...createData, ...snapshot } as Parameters<typeof prisma.expenseClaim.create>[0]["data"],
            });
            return serializeDecimalFields(created) as ExpenseClaimDocumentEntity;
        });
    },

    /**
     * Update an existing claim document
     */
    async update(
        id: string,
        data: UpdateExpenseClaimDocumentInput
    ): Promise<ExpenseClaimDocumentEntity> {
        // Strip null bytes (0x00) from all string fields — PostgreSQL rejects them
        data = sanitizeStrings(data);

        const updateData: Record<string, unknown> = {};

        if (data.expenseMonth !== undefined) {
            updateData.expenseMonth = new Date(data.expenseMonth);
        }
        if (data.claimantPositionAtSubmission !== undefined) {
            updateData.claimantPositionAtSubmission =
                data.claimantPositionAtSubmission;
        }
        if (data.selectedDates !== undefined) {
            updateData.selectedDates = (data.selectedDates ?? Prisma.JsonNull) as unknown;
        }
        if (data.countDates !== undefined) {
            updateData.countDates = data.countDates;
        }
        if (data.amount !== undefined) {
            updateData.amount = data.amount;
        }
        if (data.remark !== undefined) {
            updateData.remark = data.remark;
        }
        if (data.status !== undefined) {
            updateData.status = data.status;
        }
        if (data.monthlyRequestCollectionId !== undefined) {
            updateData.monthlyRequestCollectionId = data.monthlyRequestCollectionId;
        }
        if (data.collectedAt !== undefined) {
            updateData.collectedAt = data.collectedAt
                ? new Date(data.collectedAt)
                : null;
        }
        if (data.offSiteWorkIds !== undefined) {
            updateData.expenseClaimOffSiteWorks = {
                deleteMany: {},
                create:
                    data.offSiteWorkIds.length > 0
                        ? data.offSiteWorkIds.map((offSiteWorkId) => ({ offSiteWorkId }))
                        : [],
            };
        }

        return prisma.$transaction(async (tx) => {
            const existing = await lockClaim(tx, id);
            if (!existing) throw new Error("Expense claim document not found");
            const snapshot = needsDepartmentSnapshot(existing, data.status ?? existing.status)
                ? await captureSubmissionDepartment(tx, existing.userId) : {};
            return serializeDecimalFields(await tx.expenseClaim.update({
                where: { id }, data: { ...updateData, ...snapshot },
            })) as ExpenseClaimDocumentEntity;
        });
    },

    /**
     * Soft-delete a claim document by cancelling it
     */
    async softDelete(id: string): Promise<ExpenseClaimDocumentEntity> {
        const result = await prisma.expenseClaim.update({
            where: { id },
            data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
            },
        });

        return result as ExpenseClaimDocumentEntity;
    },

    /**
     * List claim documents with filters and pagination
     */
    async findMany(
        criteria: ExpenseClaimDocumentFilterCriteria,
        visibilityWhere: Prisma.ExpenseClaimWhereInput = {}
    ): Promise<PaginatedResult<ExpenseClaimDocumentWithRelations>> {
        const { page = 1, pageSize = 20 } = criteria;
        const where: Prisma.ExpenseClaimWhereInput = {
            AND: [claimWhere(criteria), visibilityWhere],
        };

        const [data, total] = await Promise.all([
            prisma.expenseClaim.findMany({
                where,
                include: {
                    claimant: { select: userSelect },
                    createdBy: { select: createdBySelect },
                    expenseClaimOffSiteWorks: {
                        select: {
                            offSiteWorkId: true,
                            offSiteWork: { select: offSiteWorkSelect },
                        },
                    },
                    leaderVerifications: { select: leaderVerificationSelect },
                },
                orderBy: claimOrderBy(criteria.sort),
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.expenseClaim.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);

        return {
            data: (data as ExpenseClaimDocumentWithRelations[]).map(serializeDecimalFields),
            pagination: {
                page,
                pageSize,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
            },
        };
    },
};
