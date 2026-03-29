/**
 * ExpenseClaimDocument Domain - Repository Layer
 *
 * Data access layer for expense claim documents
 *
 * @module lib/domains/expense-claim-document/repository
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
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

export const expenseClaimDocumentRepository = {
    /**
     * Find off-site work options eligible for claim creation for a specific user.
     * - Related to user: posted by user OR listed in employee_list JSON
        * - Not already linked to any APPROVED expense claim of the same user in selected month
     * - Overlaps selected month range
     */
    async findEligibleOffSiteWorksForUser(
        userId: string,
        month: Date
    ): Promise<EligibleOffSiteWorkOption[]> {
        const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
        const monthEnd = new Date(
            Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 23, 59, 59, 999)
        );

        const rows = await prisma.$queryRaw<EligibleOffSiteWorkOption[]>`
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
        status: string
    ): Promise<ExpenseClaimDocumentEntity> {
        return prisma.expenseClaim.update({
            where: { id },
            data: { status: status as never },
        }) as Promise<ExpenseClaimDocumentEntity>;
    },

    /**
     * Create a new claim document
     */
    async create(
        data: CreateExpenseClaimDocumentInput,
        userId: string,
        createdById: string
    ): Promise<ExpenseClaimDocumentEntity> {
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

        return prisma.expenseClaim.create({
            data: createData as Parameters<typeof prisma.expenseClaim.create>[0]["data"],
        }) as Promise<ExpenseClaimDocumentEntity>;
    },

    /**
     * Update an existing claim document
     */
    async update(
        id: string,
        data: UpdateExpenseClaimDocumentInput
    ): Promise<ExpenseClaimDocumentEntity> {
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

        return prisma.expenseClaim.update({
            where: { id },
            data: updateData,
        }) as Promise<ExpenseClaimDocumentEntity>;
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
        criteria: ExpenseClaimDocumentFilterCriteria
    ): Promise<PaginatedResult<ExpenseClaimDocumentWithRelations>> {
        const {
            search,
            userId,
            createdById,
            status,
            expenseMonthFrom,
            expenseMonthTo,
            includeCancelled = false,
            page = 1,
            pageSize = 20,
        } = criteria;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (!includeCancelled) {
            where.cancelledAt = null;
        }

        if (userId) {
            where.userId = userId;
        }

        if (createdById) {
            where.createdById = createdById;
        }

        if (status) {
            where.status = status;
        }

        if (expenseMonthFrom || expenseMonthTo) {
            where.expenseMonth = {};
            if (expenseMonthFrom) where.expenseMonth.gte = new Date(expenseMonthFrom);
            if (expenseMonthTo) where.expenseMonth.lte = new Date(expenseMonthTo);
        }

        if (search) {
            where.OR = [
                { id: { contains: search, mode: "insensitive" } },
                { remark: { contains: search, mode: "insensitive" } },
                {
                    claimant: {
                        OR: [
                            { firstName: { contains: search, mode: "insensitive" } },
                            { lastName: { contains: search, mode: "insensitive" } },
                            { employeeId: { contains: search, mode: "insensitive" } },
                        ],
                    },
                },
            ];
        }

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
                orderBy: [{ expenseMonth: "desc" }, { createdAt: "desc" }],
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

