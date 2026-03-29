/**
 * MonthlyRequestCollection Domain - Repository Layer
 *
 * @module lib/domains/monthly-request-collection/repository
 */

import { prisma } from "@/lib/db";
import type {
    MonthlyRequestCollectionEntity,
    MonthlyRequestCollectionWithRelations,
    MrcApprovalStepEntity,
    CreateMrcInput,
    MrcFilterCriteria,
    EligibleExpenseClaimForCollection,
} from "./types";
import type { MrcApprovalStage, MrcStepStatus } from "./types";
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
    signatures: {
        where: { isActive: true, deletedAt: null },
        select: { signatureData: true },
        take: 1,
    },
} as const;

function normalizeMonth(value: Date | string): Date {
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const monthlyRequestCollectionRepository = {
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
                status: { not: "CANCELLED" },
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
                    include: { reviewer: { select: reviewerSelect } },
                },
            },
        }) as Promise<MonthlyRequestCollectionWithRelations | null>;
    },

    async findMany(
        criteria: MrcFilterCriteria
    ): Promise<PaginatedResult<MonthlyRequestCollectionWithRelations>> {
        const page = Math.max(1, criteria.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, criteria.pageSize ?? 20));
        const skip = (page - 1) * pageSize;

        const where: Record<string, unknown> = {};

        if (criteria.status) {
            where.status = criteria.status;
        }
        if (criteria.collectorId) {
            where.collectorId = criteria.collectorId;
        }
        if (criteria.collectForMonthFrom || criteria.collectForMonthTo) {
            where.collectForMonth = {};
            if (criteria.collectForMonthFrom) {
                (where.collectForMonth as Record<string, unknown>).gte = normalizeMonth(criteria.collectForMonthFrom);
            }
            if (criteria.collectForMonthTo) {
                (where.collectForMonth as Record<string, unknown>).lte = normalizeMonth(criteria.collectForMonthTo);
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
                        include: { reviewer: { select: reviewerSelect } },
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
    async setExpenseClaims(
        id: string,
        expenseClaimIds: string[]
    ): Promise<MonthlyRequestCollectionEntity> {
        // Detach previously collected claims that are no longer in the list
        const currentClaims = await prisma.expenseClaim.findMany({
            where: { monthlyRequestCollectionId: id },
            select: { id: true },
        });
        const currentIds = currentClaims.map((c) => c.id);
        const toDetach = currentIds.filter((cId) => !expenseClaimIds.includes(cId));
        const toAttach = expenseClaimIds.filter((cId) => !currentIds.includes(cId));

        await prisma.$transaction([
            // Detach — restore to WAIT_FOR_COLLECTION because the claim must have
            // passed leader verification to have been selectable in the first place.
            ...(toDetach.length > 0
                ? [
                    prisma.expenseClaim.updateMany({
                        where: { id: { in: toDetach } },
                        data: { monthlyRequestCollectionId: null, collectedAt: null, status: "WAIT_FOR_COLLECTION" },
                    }),
                ]
                : []),
            // Attach
            ...(toAttach.length > 0
                ? [
                    prisma.expenseClaim.updateMany({
                        where: { id: { in: toAttach } },
                        data: {
                            monthlyRequestCollectionId: id,
                            collectedAt: new Date(),
                            status: "COLLECTED",
                        },
                    }),
                ]
                : []),
        ]);

        // Recompute aggregates
        const claims = await prisma.expenseClaim.findMany({
            where: { monthlyRequestCollectionId: id, cancelledAt: null },
            select: { countDates: true, amount: true },
        });

        let totalDates = 0;
        let totalAmount = 0;
        for (const c of claims) {
            totalDates += c.countDates ? Number(c.countDates) : 0;
            totalAmount += c.amount ? Number(c.amount) : 0;
        }

        return prisma.monthlyRequestCollection.update({
            where: { id },
            data: {
                countDates: totalDates || null,
                amount: totalAmount || null,
            },
        }) as Promise<MonthlyRequestCollectionEntity>;
    },

    async updateStatus(
        id: string,
        status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED",
        cancelledAt?: Date
    ): Promise<MonthlyRequestCollectionEntity> {
        return prisma.monthlyRequestCollection.update({
            where: { id },
            data: {
                status,
                ...(cancelledAt !== undefined ? { cancelledAt } : {}),
            },
        }) as Promise<MonthlyRequestCollectionEntity>;
    },

    // -----------------------------------------------------------------------
    // Approval steps
    // -----------------------------------------------------------------------

    async findApprovalStep(
        mrcId: string,
        stage: MrcApprovalStage
    ): Promise<MrcApprovalStepEntity | null> {
        return prisma.mrcApprovalStep.findUnique({
            where: { monthlyRequestCollectionId_stage: { monthlyRequestCollectionId: mrcId, stage } },
        }) as Promise<MrcApprovalStepEntity | null>;
    },

    async createApprovalStep(
        mrcId: string,
        stage: MrcApprovalStage
    ): Promise<MrcApprovalStepEntity> {
        return prisma.mrcApprovalStep.create({
            data: { monthlyRequestCollectionId: mrcId, stage, status: "PENDING" },
        }) as Promise<MrcApprovalStepEntity>;
    },

    async reviewApprovalStep(
        mrcId: string,
        stage: MrcApprovalStage,
        status: MrcStepStatus,
        reviewerId: string,
        remark?: string
    ): Promise<MrcApprovalStepEntity> {
        return prisma.mrcApprovalStep.update({
            where: { monthlyRequestCollectionId_stage: { monthlyRequestCollectionId: mrcId, stage } },
            data: { status, reviewerId, reviewedAt: new Date(), remark: remark ?? null },
        }) as Promise<MrcApprovalStepEntity>;
    },

    // -----------------------------------------------------------------------
    // Expense claim bulk status update (final approval / rejection revert)
    // -----------------------------------------------------------------------

    async bulkUpdateLinkedClaimsStatus(
        mrcId: string,
        status: "APPROVED" | "PENDING"
    ): Promise<void> {
        await prisma.expenseClaim.updateMany({
            where: { monthlyRequestCollectionId: mrcId, cancelledAt: null },
            data: { status },
        });
    },

    /**
     * Roll back all non-cancelled ECDs linked to this MRC to WAIT_FOR_COLLECTION
     * and unlink them so that admin can collect them again in a future MRC.
     */
    async rollbackLinkedClaimsOnCancel(mrcId: string): Promise<void> {
        await prisma.expenseClaim.updateMany({
            where: { monthlyRequestCollectionId: mrcId, cancelledAt: null },
            data: {
                status: "WAIT_FOR_COLLECTION",
                monthlyRequestCollectionId: null,
                collectedAt: null,
            },
        });
    },
};
