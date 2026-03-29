/**
 * LeaderVerification Domain - Repository Layer
 *
 * @module lib/domains/leader-verification/repository
 */

import { prisma } from "@/lib/db";
import type {
    LeaderVerificationEntity,
    LeaderVerificationWithRelations,
    CreateLeaderVerificationInput,
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

export const leaderVerificationRepository = {
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
    ): Promise<LeaderVerificationWithRelations[]> {
        return prisma.leaderVerification.findMany({
            where: {
                leaderUserId: userId,
                verifiedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: {
                expenseClaim: { select: expenseClaimSelect },
                offSiteWork: { select: offSiteWorkSelect },
                leaderUser: { select: leaderUserSelect },
            },
            orderBy: { createdAt: "asc" },
        }) as Promise<LeaderVerificationWithRelations[]>;
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
