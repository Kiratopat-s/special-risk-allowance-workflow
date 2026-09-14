/**
 * MonthlyRequestCollection Domain - Repository Layer
 *
 * @module lib/domains/monthly-request-collection/repository
 */

import { prisma } from "@/lib/db";
import { claimPrintSelect } from "@/lib/domains/expense-claim-document/print-data";
import { collectionVisibilityWhere, type CollectionReadAccess } from "./read-policy";
import type {
    MonthlyRequestCollectionEntity,
    MonthlyRequestCollectionWithRelations,
    MrcSummaryPrintData,
    ReviewMrcStepInput,
    CreateMrcInput,
    MrcFilterCriteria,
    EligibleExpenseClaimForCollection,
} from "./types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { success, error, type Result } from "@/lib/shared/types";
import type { PaginatedResult } from "@/lib/shared/types";

// ---------------------------------------------------------------------------
// Shared select shapes
// ---------------------------------------------------------------------------

const collectorSelect = {
    id: true,
    firstName: true,
    lastName: true,
    employeeId: true,
} as const;

const claimantSelect = {
    id: true,
    firstName: true,
    lastName: true,
    employeeId: true,
    position: true,
    positionShort: true,
    positionLevel: true,
    departmentId: true,
    department: { select: { shortName: true } },
} as const;

const reviewerSelect = {
    id: true,
    firstName: true,
    lastName: true,
    positionShort: true,
    positionLevel: true,
} as const;

function normalizeMonth(value: Date | string): Date {
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Never select signature bytes for list/detail responses.
const approvalStepSelect = {
    id: true, monthlyRequestCollectionId: true, stage: true, status: true,
    reviewerId: true, reviewedAt: true, remark: true, createdAt: true, updatedAt: true,
    reviewerNameAtApproval: true, reviewerPositionAtApproval: true,
    reviewer: { select: reviewerSelect },
} as const;

async function lockCollection(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM monthly_request_collections WHERE id = ${id} FOR UPDATE`;
    return tx.monthlyRequestCollection.findUnique({ where: { id } });
}

async function releaseClaims(tx: Prisma.TransactionClient, id: string) {
    await tx.expenseClaim.updateMany({
        where: { monthlyRequestCollectionId: id, cancelledAt: null },
        data: { status: "WAIT_FOR_COLLECTION", monthlyRequestCollectionId: null, collectedAt: null },
    });
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const monthlyRequestCollectionRepository = {
    async findPrintAccess(id: string) {
        return prisma.monthlyRequestCollection.findUnique({
            where: { id },
            select: { collectorId: true, status: true, approvalSteps: { select: { stage: true, status: true } } },
        });
    },

    async findSummaryForPrint(id: string, access: CollectionReadAccess): Promise<MrcSummaryPrintData | null> {
        return prisma.monthlyRequestCollection.findFirst({
            where: { AND: [{ id }, collectionVisibilityWhere(access)] },
            include: {
                collector: { select: collectorSelect },
                expenseClaims: { where: { cancelledAt: null }, include: { claimant: { select: claimantSelect } } },
                approvalSteps: { where: { stage: "HPA_CHECK" }, select: { ...approvalStepSelect, signatureData: true } },
            },
        });
    },

    async findClaimsForPrint(id: string, access: CollectionReadAccess) {
        return prisma.monthlyRequestCollection.findFirst({
            where: { AND: [{ id }, collectionVisibilityWhere(access)] },
            select: {
                expenseClaims: {
                    where: { cancelledAt: null, status: { not: "CANCELLED" } },
                    orderBy: [
                        { claimant: { employeeId: "asc" } },
                        { claimant: { firstName: "asc" } },
                        { claimant: { lastName: "asc" } },
                        { id: "asc" },
                    ],
                    select: claimPrintSelect,
                },
            },
        });
    },
    // -----------------------------------------------------------------------
    // Read
    // -----------------------------------------------------------------------

    async findById(id: string): Promise<MonthlyRequestCollectionEntity | null> {
        return prisma.monthlyRequestCollection.findFirst({
            where: { id },
        }) as Promise<MonthlyRequestCollectionEntity | null>;
    },

    /**
     * Returns true if any non-CANCELLED MRC already exists for the given month.
     * Used to enforce the "one active MRC per month" business rule.
     */
    async findActiveForMonth(month: Date): Promise<boolean> {
        const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
        const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        const count = await prisma.monthlyRequestCollection.count({
            where: {
                collectForMonth: { gte: start, lte: end },
                status: { notIn: ["CANCELLED", "REJECTED"] },
            },
        });
        return count > 0;
    },

    async findWithRelations(id: string): Promise<MonthlyRequestCollectionWithRelations | null> {
        return prisma.monthlyRequestCollection.findFirst({
            where: { id },
            include: {
                collector: { select: collectorSelect },
                expenseClaims: {
                    where: { cancelledAt: null },
                    include: { claimant: { select: claimantSelect } },
                },
                approvalSteps: {
                    orderBy: { createdAt: "asc" },
                    select: approvalStepSelect,
                },
            },
        }) as Promise<MonthlyRequestCollectionWithRelations | null>;
    },

    async findMany(
        criteria: MrcFilterCriteria,
        access: CollectionReadAccess
    ): Promise<PaginatedResult<MonthlyRequestCollectionWithRelations>> {
        const page = Math.max(1, criteria.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, criteria.pageSize ?? 20));
        const skip = (page - 1) * pageSize;

        const where: Prisma.MonthlyRequestCollectionWhereInput = { AND: [collectionVisibilityWhere(access)] };

        if (criteria.status) {
            where.status = criteria.status;
        }
        if (criteria.collectorId) {
            where.collectorId = criteria.collectorId;
        }
        if (criteria.collectForMonthFrom || criteria.collectForMonthTo) {
            where.collectForMonth = {};
            if (criteria.collectForMonthFrom) {
                (where.collectForMonth as Prisma.DateTimeFilter).gte = normalizeMonth(criteria.collectForMonthFrom);
            }
            if (criteria.collectForMonthTo) {
                (where.collectForMonth as Prisma.DateTimeFilter).lte = normalizeMonth(criteria.collectForMonthTo);
            }
        }

        const [data, total] = await Promise.all([
            prisma.monthlyRequestCollection.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ collectForMonth: "desc" }, { createdAt: "desc" }],
                include: {
                    collector: { select: collectorSelect },
                    expenseClaims: {
                        where: { cancelledAt: null },
                        include: { claimant: { select: claimantSelect } },
                    },
                    approvalSteps: {
                        orderBy: { createdAt: "asc" },
                        select: approvalStepSelect,
                    },
                },
            }),
            prisma.monthlyRequestCollection.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);
        return {
            data: data as MonthlyRequestCollectionWithRelations[],
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

    /**
     * Find expense claims for a specific month that can be picked in the MRC UI.
     *
     * Eligibility rules:
     * 1. Unlinked claims (monthlyRequestCollectionId IS NULL) with a collectable status.
     * 2. Claims still FK-linked to a CANCELLED MRC — treated as available again.
     *    This is a safety net for legacy rows that were not unlinked when their MRC
     *    was cancelled with the old cancel logic.
     * 3. (edit mode only) Claims already linked to the MRC being edited, regardless
     *    of their current status.
     */
    async findEligibleExpenseClaimsForMonth(
        month: Date,
        existingMrcId?: string
    ): Promise<EligibleExpenseClaimForCollection[]> {
        const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 23, 59, 59, 999));

        const rows = await prisma.expenseClaim.findMany({
            where: {
                cancelledAt: null,
                expenseMonth: { gte: monthStart, lte: monthEnd },
                OR: [
                    // 1. Completely unlinked and in a collectable status
                    {
                        status: { in: ["PENDING", "PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION"] },
                        monthlyRequestCollectionId: null,
                    },
                    // 2. Still FK-linked to a cancelled MRC (legacy rows not yet unlinked)
                    {
                        status: { in: ["PENDING", "PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION"] },
                        monthlyRequestCollection: { status: "CANCELLED" },
                    },
                    // 3. Already part of the MRC being edited
                    ...(existingMrcId
                        ? [
                            {
                                monthlyRequestCollectionId: existingMrcId,
                            },
                        ]
                        : []),
                ],
            },
            select: {
                id: true,
                expenseMonth: true,
                userId: true,
                claimantPositionAtSubmission: true,
                countDates: true,
                amount: true,
                remark: true,
                status: true,
                claimant: { select: claimantSelect },
            },
            orderBy: [{ claimant: { lastName: "asc" } }, { createdAt: "asc" }],
        });

        return rows.map((row) => ({
            ...row,
            isVerified: row.status === "WAIT_FOR_COLLECTION",
        })) as EligibleExpenseClaimForCollection[];
    },

    // -----------------------------------------------------------------------
    // Write
    // -----------------------------------------------------------------------

    async create(
        data: CreateMrcInput,
        collectorId: string
    ): Promise<MonthlyRequestCollectionEntity> {
        const month = normalizeMonth(data.collectForMonth);
        return prisma.monthlyRequestCollection.create({
            data: {
                collectorId,
                collectForMonth: month,
                status: "DRAFT",
            },
        }) as Promise<MonthlyRequestCollectionEntity>;
    },

    /**
     * Connect / disconnect expense claims to this MRC and recompute totals.
     */
    async setExpenseClaims(id: string, expenseClaimIds: string[]): Promise<Result<MonthlyRequestCollectionEntity>> {
        return prisma.$transaction(async (tx) => {
            const mrc = await lockCollection(tx, id);
            if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
            if (mrc.status !== "DRAFT") return error("แก้ไขได้เฉพาะรายการร่าง", "MRC_NOT_DRAFT");
            // Recheck under the same lock used by submit/review, so a stale editor
            // cannot replace claims after they have been submitted or signed.
            await tx.expenseClaim.updateMany({
                where: { monthlyRequestCollectionId: id, id: { notIn: expenseClaimIds } },
                data: { monthlyRequestCollectionId: null, collectedAt: null, status: "WAIT_FOR_COLLECTION" },
            });
            await tx.expenseClaim.updateMany({
                where: { id: { in: expenseClaimIds }, monthlyRequestCollectionId: null, cancelledAt: null },
                data: { monthlyRequestCollectionId: id, collectedAt: new Date(), status: "COLLECTED" },
            });
            const totals = await tx.expenseClaim.aggregate({
                where: { monthlyRequestCollectionId: id, cancelledAt: null },
                _sum: { countDates: true, amount: true },
            });
            return success(await tx.monthlyRequestCollection.update({ where: { id }, data: totals._sum }));
        });
    },

    /** Lock the parent row so submit, review and cancel cannot interleave. */
    async submitForReview(id: string): Promise<Result<MonthlyRequestCollectionEntity>> {
        return prisma.$transaction(async (tx) => {
            const mrc = await lockCollection(tx, id);
            if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
            if (mrc.status !== "DRAFT") return error("ส่งได้เฉพาะรายการร่าง", "MRC_NOT_DRAFT");
            await tx.mrcApprovalStep.create({ data: { monthlyRequestCollectionId: id, stage: "HPA_CHECK" } });
            return success(await tx.monthlyRequestCollection.update({ where: { id }, data: { status: "PENDING" } }));
        });
    },

    async reviewCollection(
        id: string, input: ReviewMrcStepInput, actorId: string,
    ): Promise<Result<MonthlyRequestCollectionEntity>> {
        return prisma.$transaction(async (tx) => {
            const mrc = await lockCollection(tx, id);
            if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
            if (mrc.status !== "PENDING") return error("รายการไม่ได้อยู่ระหว่างรออนุมัติ", "MRC_NOT_PENDING");
            const step = await tx.mrcApprovalStep.findUnique({
                where: { monthlyRequestCollectionId_stage: { monthlyRequestCollectionId: id, stage: "HPA_CHECK" } },
                select: { id: true, status: true },
            });
            if (!step || step.status !== "PENDING") return error("ขั้นตอนนี้ไม่เปิดให้ดำเนินการ", "STEP_NOT_PENDING");
            // Read the actual signer and active image on the server, inside this transaction.
            const signer = await tx.user.findUnique({ where: { id: actorId }, select: reviewerSelect });
            const signature = await tx.signature.findFirst({
                where: { userId: actorId, isActive: true, deletedAt: null },
                select: { signatureData: true },
            });
            if (!signature || !signer) return error("กรุณาลงลายมือชื่อก่อนอนุมัติเอกสาร", "SIGNATURE_REQUIRED");
            const status = input.approved ? "APPROVED" : "REJECTED";
            await tx.mrcApprovalStep.update({
                where: { id: step.id },
                data: {
                    status, reviewerId: actorId, reviewedAt: new Date(), remark: input.remark ?? null,
                    signatureData: input.approved ? signature.signatureData : null,
                    reviewerNameAtApproval: input.approved ? `${signer.firstName} ${signer.lastName}` : null,
                    reviewerPositionAtApproval: input.approved
                        ? [signer.positionShort, signer.positionLevel].filter(Boolean).join(" ") : null,
                },
            });
            if (input.approved) {
                await tx.expenseClaim.updateMany({
                    where: { monthlyRequestCollectionId: id, cancelledAt: null },
                    data: { status: "APPROVED" },
                });
            } else {
                await releaseClaims(tx, id);
            }
            return success(await tx.monthlyRequestCollection.update({ where: { id }, data: { status } }));
        });
    },

    async cancelCollection(id: string): Promise<Result<MonthlyRequestCollectionEntity>> {
        return prisma.$transaction(async (tx) => {
            const mrc = await lockCollection(tx, id);
            if (!mrc) return error("ไม่พบรายการรวบรวม", "MRC_NOT_FOUND");
            if (mrc.status === "CANCELLED") return error("ยกเลิกแล้ว", "MRC_ALREADY_CANCELLED");
            if (mrc.status === "APPROVED") return error("ยกเลิกรายการที่อนุมัติแล้วไม่ได้", "MRC_APPROVED");
            const approved = await tx.mrcApprovalStep.count({ where: { monthlyRequestCollectionId: id, status: "APPROVED" } });
            if (approved) return error("มีผู้อนุมัติรายการแล้ว", "MRC_STEP_ALREADY_APPROVED");
            await releaseClaims(tx, id);
            return success(await tx.monthlyRequestCollection.update({
                where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() },
            }));
        });
    },
};
