/**
 * LeaderVerification Domain - Repository Layer
 *
 * @module lib/domains/leader-verification/repository
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toSelectedDates } from "@/lib/domains/expense-claim-document/types";
import type {
    LeaderVerificationEntity,
    LeaderVerificationWithRelations,
    CreateLeaderVerificationInput,
    LeaderVerificationQueueItem,
    LeaderClaimDetail,
} from "./types";

const expenseClaimSelect = {
    id: true,
    expenseMonth: true,
    userId: true,
    claimantPositionAtSubmission: true,
    status: true,
    claimant: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
        },
    },
} as const;

const offSiteWorkSelect = {
    id: true,
    innerRefDocumentId: true,
    startDate: true,
    endDate: true,
    location: true,
    objective: true,
    leaderFirstName: true,
    leaderLastName: true,
    leaderPosition: true,
    leaderEmpId: true,
} as const;

const leaderUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    employeeId: true,
} as const;

// These selects are internal-only. Expanding a queue must not expand token access.
const leaderClaimSelect = {
    id: true,
    expenseMonth: true,
    claimantPositionAtSubmission: true,
    status: true,
    selectedDates: true,
    countDates: true,
    amount: true,
    claimant: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
} satisfies Prisma.ExpenseClaimSelect;

const queueSelect = {
    id: true,
    expenseClaimId: true,
    offSiteWorkId: true,
    expiresAt: true,
    verifiedAt: true,
    createdAt: true,
    expenseClaim: {
        select: {
            ...leaderClaimSelect,
            expenseClaimOffSiteWorks: { select: { offSiteWorkId: true } },
        },
    },
    offSiteWork: { select: offSiteWorkSelect },
} satisfies Prisma.LeaderVerificationSelect;

const claimDetailSelect = {
    ...leaderClaimSelect,
    remark: true,
    expenseClaimOffSiteWorks: {
        where: { offSiteWork: { deletedAt: null } },
        select: {
            offSiteWorkId: true,
            offSiteWork: {
                select: {
                    id: true,
                    innerRefDocumentId: true,
                    startDate: true,
                    endDate: true,
                    location: true,
                    objective: true,
                },
            },
        },
        orderBy: { offSiteWorkId: "asc" },
    },
} satisfies Prisma.ExpenseClaimSelect;

type LeaderClaimSource = Prisma.ExpenseClaimGetPayload<{ select: typeof leaderClaimSelect }>;

function serializeClaimSummary(claim: LeaderClaimSource): LeaderVerificationQueueItem["expenseClaim"] {
    return {
        id: claim.id,
        expenseMonth: claim.expenseMonth,
        claimantPositionAtSubmission: claim.claimantPositionAtSubmission,
        status: claim.status,
        selectedDates: toSelectedDates(claim.selectedDates),
        countDates: claim.countDates == null ? null : Number(claim.countDates),
        amount: claim.amount == null ? null : Number(claim.amount),
        claimant: claim.claimant,
    };
}

export const leaderVerificationRepository = {
    /** A late verification must never reopen a collected or approved claim. */
    async markReadyForCollection(expenseClaimId: string): Promise<boolean> {
        const updated = await prisma.expenseClaim.updateMany({
            where: {
                id: expenseClaimId, cancelledAt: null, monthlyRequestCollectionId: null,
                status: { in: ["PENDING", "PENDING_LEADER_VERIFY"] },
            },
            data: { status: "WAIT_FOR_COLLECTION" },
        });
        return updated.count > 0;
    },

    async create(data: CreateLeaderVerificationInput): Promise<LeaderVerificationEntity> {
        return prisma.leaderVerification.create({
            data: {
                expenseClaimId: data.expenseClaimId,
                offSiteWorkId: data.offSiteWorkId,
                leaderUserId: data.leaderUserId ?? null,
                leaderEmail: data.leaderEmail ?? null,
                expiresAt: data.expiresAt,
            },
        }) as Promise<LeaderVerificationEntity>;
    },

    async createMany(records: CreateLeaderVerificationInput[]): Promise<void> {
        await prisma.leaderVerification.createMany({
            data: records.map((r) => ({
                expenseClaimId: r.expenseClaimId,
                offSiteWorkId: r.offSiteWorkId,
                leaderUserId: r.leaderUserId ?? null,
                leaderEmail: r.leaderEmail ?? null,
                expiresAt: r.expiresAt,
            })),
            skipDuplicates: true,
        });
    },

    async findByToken(token: string): Promise<LeaderVerificationWithRelations | null> {
        return prisma.leaderVerification.findUnique({
            where: { token },
            include: {
                expenseClaim: { select: expenseClaimSelect },
                offSiteWork: { select: offSiteWorkSelect },
                leaderUser: { select: leaderUserSelect },
            },
        }) as Promise<LeaderVerificationWithRelations | null>;
    },

    async findByClaimAndOsw(
        expenseClaimId: string,
        offSiteWorkId: string
    ): Promise<LeaderVerificationEntity | null> {
        return prisma.leaderVerification.findUnique({
            where: { expenseClaimId_offSiteWorkId: { expenseClaimId, offSiteWorkId } },
        }) as Promise<LeaderVerificationEntity | null>;
    },

    async findPendingByLeaderUserId(
        userId: string
    ): Promise<LeaderVerificationQueueItem[]> {
        const records = await prisma.leaderVerification.findMany({
            where: {
                leaderUserId: userId,
                verifiedAt: null,
                expiresAt: { gt: new Date() },
                expenseClaim: { cancelledAt: null, status: { not: "CANCELLED" } },
                offSiteWork: { deletedAt: null },
            },
            select: queueSelect,
            orderBy: { createdAt: "asc" },
        });

        // A stale verification must not restore access after its order is unlinked.
        return records.filter((record) => record.expenseClaim.expenseClaimOffSiteWorks.some(
            (link) => link.offSiteWorkId === record.offSiteWorkId,
        )).map((record) => ({
            id: record.id,
            expenseClaimId: record.expenseClaimId,
            offSiteWorkId: record.offSiteWorkId,
            expiresAt: record.expiresAt,
            verifiedAt: record.verifiedAt,
            createdAt: record.createdAt,
            expenseClaim: serializeClaimSummary(record.expenseClaim),
            offSiteWork: record.offSiteWork,
        }));
    },

    async findClaimDetailForLeader(
        expenseClaimId: string,
        userId: string,
    ): Promise<LeaderClaimDetail | null> {
        const claim = await prisma.expenseClaim.findFirst({
            where: {
                id: expenseClaimId,
                cancelledAt: null,
                status: { not: "CANCELLED" },
                expenseClaimOffSiteWorks: {
                    some: {
                        offSiteWork: {
                            deletedAt: null,
                            leaderVerifications: { some: { expenseClaimId, leaderUserId: userId } },
                        },
                    },
                },
            },
            select: claimDetailSelect,
        });
        if (!claim) return null;
        return {
            ...serializeClaimSummary(claim),
            remark: claim.remark,
            expenseClaimOffSiteWorks: claim.expenseClaimOffSiteWorks,
        };
    },

    async findAllByExpenseClaimId(
        expenseClaimId: string
    ): Promise<LeaderVerificationEntity[]> {
        return prisma.leaderVerification.findMany({
            where: { expenseClaimId },
        }) as Promise<LeaderVerificationEntity[]>;
    },

    async verify(id: string, signatureData?: Buffer | null): Promise<LeaderVerificationEntity> {
        return prisma.leaderVerification.update({
            where: { id },
            data: {
                verifiedAt: new Date(),
                ...(signatureData != null ? { signatureData: new Uint8Array(signatureData) } : {}),
            },
        }) as Promise<LeaderVerificationEntity>;
    },

    /** Delete all verification records for a claim-OSW pair (used on claim update). */
    async deleteByClaimAndOswIds(
        expenseClaimId: string,
        offSiteWorkIds: string[]
    ): Promise<void> {
        await prisma.leaderVerification.deleteMany({
            where: { expenseClaimId, offSiteWorkId: { in: offSiteWorkIds } },
        });
    },

    /** Delete all verifications for an expense claim. */
    async deleteAllByClaimId(expenseClaimId: string): Promise<void> {
        await prisma.leaderVerification.deleteMany({ where: { expenseClaimId } });
    },
};
