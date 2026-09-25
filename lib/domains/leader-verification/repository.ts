/**
 * LeaderVerification Domain - Repository Layer
 *
 * @module lib/domains/leader-verification/repository
 */

import { prisma } from "@/lib/db";
import { lockClaim } from "@/lib/domains/expense-claim-document/department-snapshot";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toSelectedDates } from "@/lib/domains/expense-claim-document/types";
import type {
    LeaderVerificationEntity,
    LeaderVerificationWithRelations,
    CreateLeaderVerificationInput,
    LeaderVerificationQueueItem,
    LeaderClaimDetail,
    TokenVerificationView,
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

// Token review uses its own explicit projection below; queue changes do not grant public fields.
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

const tokenReviewSelect = {
    id: true,
    offSiteWorkId: true,
    expiresAt: true,
    verifiedAt: true,
    expenseClaim: {
        select: {
            ...claimDetailSelect,
            claimant: { select: { firstName: true, lastName: true, employeeId: true } },
        },
    },
    offSiteWork: {
        select: {
            id: true,
            innerRefDocumentId: true,
            startDate: true,
            endDate: true,
            location: true,
            objective: true,
            leaderFirstName: true,
            leaderLastName: true,
            leaderPosition: true,
        },
    },
} satisfies Prisma.LeaderVerificationSelect;

type TokenReviewRecord = Omit<Extract<TokenVerificationView, { state: "ready" }>, "state"> & {
    verifiedAt: Date | null;
};

function serializeClaimFields(claim: Omit<LeaderClaimSource, "claimant">): Omit<LeaderVerificationQueueItem["expenseClaim"], "claimant"> {
    return {
        id: claim.id,
        expenseMonth: claim.expenseMonth,
        claimantPositionAtSubmission: claim.claimantPositionAtSubmission,
        status: claim.status,
        selectedDates: toSelectedDates(claim.selectedDates),
        countDates: claim.countDates == null ? null : Number(claim.countDates),
        amount: claim.amount == null ? null : Number(claim.amount),
    };
}

function serializeClaimSummary(claim: LeaderClaimSource): LeaderVerificationQueueItem["expenseClaim"] {
    return { ...serializeClaimFields(claim), claimant: claim.claimant };
}

export const leaderVerificationRepository = {
    /** A late verification must never reopen a collected or approved claim. */
    async markReadyForCollection(expenseClaimId: string): Promise<boolean> {
        return prisma.$transaction(async (tx) => {
            const claim = await lockClaim(tx, expenseClaimId);
            if (!claim || claim.cancelledAt || claim.monthlyRequestCollectionId ||
                !["PENDING", "PENDING_LEADER_VERIFY"].includes(claim.status)) return false;
            // A prior all-done read may refer to signatures invalidated by an edit.
            const [records, links] = await Promise.all([
                tx.leaderVerification.findMany({ where: { expenseClaimId }, select: { offSiteWorkId: true, verifiedAt: true } }),
                tx.expenseClaimOffSiteWork.findMany({ where: { expenseClaimId }, select: { offSiteWorkId: true } }),
            ]);
            if (!links.length || links.some((link) => !records.some((record) =>
                record.offSiteWorkId === link.offSiteWorkId && record.verifiedAt !== null))) return false;
            await tx.expenseClaim.update({ where: { id: expenseClaimId }, data: { status: "WAIT_FOR_COLLECTION" } });
            return true;
        });
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

    /** Public reads remain scoped to the token's active, still-linked order. */
    async findReviewByToken(token: string): Promise<TokenReviewRecord | null> {
        const record = await prisma.leaderVerification.findFirst({
            where: {
                token,
                expenseClaim: { cancelledAt: null, status: { notIn: ["DRAFT", "CANCELLED"] } },
                offSiteWork: { deletedAt: null },
            },
            select: tokenReviewSelect,
        });
        if (!record || !record.expenseClaim.expenseClaimOffSiteWorks.some(
            (link) => link.offSiteWorkId === record.offSiteWorkId,
        )) return null;

        const claim = record.expenseClaim;
        const work = record.offSiteWork;
        return {
            id: record.id,
            offSiteWorkId: record.offSiteWorkId,
            expiresAt: record.expiresAt,
            verifiedAt: record.verifiedAt,
            expenseClaim: {
                ...serializeClaimFields(claim),
                claimant: {
                    firstName: claim.claimant.firstName,
                    lastName: claim.claimant.lastName,
                    employeeId: claim.claimant.employeeId,
                },
                remark: claim.remark,
                expenseClaimOffSiteWorks: claim.expenseClaimOffSiteWorks.map(({ offSiteWorkId, offSiteWork }) => ({
                    offSiteWorkId,
                    offSiteWork: {
                        id: offSiteWork.id,
                        innerRefDocumentId: offSiteWork.innerRefDocumentId,
                        startDate: offSiteWork.startDate,
                        endDate: offSiteWork.endDate,
                        location: offSiteWork.location,
                        objective: offSiteWork.objective,
                    },
                })),
            },
            offSiteWork: {
                id: work.id,
                innerRefDocumentId: work.innerRefDocumentId,
                startDate: work.startDate,
                endDate: work.endDate,
                location: work.location,
                objective: work.objective,
                leaderFirstName: work.leaderFirstName,
                leaderLastName: work.leaderLastName,
                leaderPosition: work.leaderPosition,
            },
        };
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

    async verify(id: string, signatureData?: Buffer | null): Promise<LeaderVerificationEntity | null> {
        const record = await prisma.leaderVerification.findUnique({ where: { id }, select: { expenseClaimId: true } });
        if (!record) return null;
        return prisma.$transaction(async (tx) => {
            const claim = await lockClaim(tx, record.expenseClaimId);
            if (!claim || claim.cancelledAt || ["DRAFT", "CANCELLED"].includes(claim.status)) return null;
            // Claim edits delete and replace these IDs. Never sign a replacement
            // using a request that was authorized for the previous date selection.
            const current = await tx.leaderVerification.findUnique({ where: { id } });
            if (!current || current.expiresAt <= new Date()) return null;
            if (current.verifiedAt) return current as LeaderVerificationEntity;
            return tx.leaderVerification.update({
                where: { id }, data: {
                    verifiedAt: new Date(),
                    ...(signatureData != null ? { signatureData: new Uint8Array(signatureData) } : {}),
                },
            }) as Promise<LeaderVerificationEntity>;
        });
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
