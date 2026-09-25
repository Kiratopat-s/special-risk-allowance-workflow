/**
 * LeaderVerification Domain - Service Layer
 *
 * @module lib/domains/leader-verification/service
 */

import { uuidv7 } from "uuidv7";
import { leaderVerificationRepository } from "./repository";
import { prisma } from "@/lib/db";
import { success, error, type Result } from "@/lib/shared/types";
import { sendLeaderVerifyEmail } from "@/lib/email";
import type {
    LeaderVerificationEntity,
    CreateLeaderVerificationInput,
    LeaderVerificationQueueItem,
    LeaderClaimDetail,
    TokenVerificationView,
} from "./types";

// Lazy-import to avoid circular deps
async function getNotificationService() {
    const { notificationService } = await import("@/lib/domains/notification");
    return notificationService;
}

/** Token validity period: 7 days */
const TOKEN_TTL_DAYS = 7;

function makeExpiresAt(): Date {
    const d = new Date();
    d.setDate(d.getDate() + TOKEN_TTL_DAYS);
    return d;
}

export interface VerifyResult {
    verified: boolean;
    allDone: boolean;
    expenseClaimId: string;
}

export const leaderVerificationService = {
    /** A bearer token grants review details only until expiry or verification. */
    async getVerificationByToken(token: string): Promise<Result<TokenVerificationView>> {
        if (typeof token !== "string" || !token.trim()) {
            return error("ลิงก์ยืนยันไม่ถูกต้อง", "INVALID_TOKEN");
        }
        const record = await leaderVerificationRepository.findReviewByToken(token);
        if (!record) {
            return error("ไม่พบรายการยืนยัน หรือลิงก์ไม่ถูกต้อง", "TOKEN_NOT_FOUND");
        }
        if (record.verifiedAt) {
            return success({ state: "already_verified", offSiteWorkId: record.offSiteWorkId, verifiedAt: record.verifiedAt });
        }
        if (record.expiresAt <= new Date()) {
            return error("ลิงก์ยืนยันหมดอายุแล้ว กรุณาติดต่อผู้ยื่นเอกสารเพื่อขอลิงก์ใหม่", "TOKEN_EXPIRED");
        }
        return success({
            state: "ready",
            id: record.id,
            offSiteWorkId: record.offSiteWorkId,
            expiresAt: record.expiresAt,
            expenseClaim: record.expenseClaim,
            offSiteWork: record.offSiteWork,
        });
    },

    /**
     * Create verification records for each OSW that has a leader.
     * Returns the created records so the caller can extract share URLs.
     */
    async createForClaim(
        expenseClaimId: string,
        offSiteWorkIds: string[]
    ): Promise<LeaderVerificationEntity[]> {
        if (!offSiteWorkIds.length) return [];

        // Fetch OSWs with their leader data
        const [osws, claim] = await Promise.all([
            prisma.offSiteWork.findMany({
                where: { id: { in: offSiteWorkIds }, deletedAt: null },
                select: {
                    id: true,
                    innerRefDocumentId: true,
                    leaderUserId: true,
                    leaderEmail: true,
                },
            }),
            prisma.expenseClaim.findUnique({
                where: { id: expenseClaimId },
                select: { claimant: { select: { firstName: true, lastName: true } } },
            }),
        ]);

        const claimantName = claim?.claimant
            ? `${claim.claimant.firstName} ${claim.claimant.lastName}`.trim()
            : undefined;

        const records: CreateLeaderVerificationInput[] = [];
        for (const osw of osws) {
            const hasInternalLeader = !!osw.leaderUserId;
            const hasExternalLeader = !!osw.leaderEmail;
            if (!hasInternalLeader && !hasExternalLeader) continue;

            records.push({
                expenseClaimId,
                offSiteWorkId: osw.id,
                leaderUserId: osw.leaderUserId ?? null,
                leaderEmail: osw.leaderEmail ?? null,
                expiresAt: makeExpiresAt(),
            });
        }

        if (!records.length) return [];

        await leaderVerificationRepository.createMany(records);

        // Re-fetch to get IDs + tokens
        const created = await leaderVerificationRepository.findAllByExpenseClaimId(expenseClaimId);

        dispatchVerificationNotifications(created, osws, claimantName);

        return created;
    },

    /** Notify after the caller has committed new verification records atomically. */
    async notifyForClaim(expenseClaimId: string): Promise<void> {
        try {
            const created = (await leaderVerificationRepository.findAllByExpenseClaimId(expenseClaimId))
                .filter((record) => !record.verifiedAt);
            if (!created.length) return;
            const [osws, claim] = await Promise.all([
                prisma.offSiteWork.findMany({
                    where: { id: { in: created.map((record) => record.offSiteWorkId) }, deletedAt: null },
                    select: { id: true, innerRefDocumentId: true },
                }),
                prisma.expenseClaim.findUnique({
                    where: { id: expenseClaimId },
                    select: { claimant: { select: { firstName: true, lastName: true } } },
                }),
            ]);
            const claimantName = claim?.claimant ? `${claim.claimant.firstName} ${claim.claimant.lastName}`.trim() : undefined;
            dispatchVerificationNotifications(created, osws, claimantName);
        } catch {
            // The claim and verification requests have already committed. Optional
            // notification lookup failures must not report that the save failed.
        }
    },

    /**
     * Verify via external token link.
     * Updates the record and transitions the claim to WAIT_FOR_COLLECTION if all done.
     */
    async verifyByToken(token: string, signatureData?: Buffer | null): Promise<Result<VerifyResult>> {
        const record = await leaderVerificationRepository.findByToken(token);

        if (!record) {
            return error("ไม่พบรายการยืนยัน หรือลิงก์ไม่ถูกต้อง", "VERIFICATION_NOT_FOUND");
        }

        if (record.verifiedAt) {
            return success(
                { verified: true, allDone: true, expenseClaimId: record.expenseClaimId },
                "ยืนยันแล้ว"
            );
        }

        if (new Date() > record.expiresAt) {
            return error("ลิงก์ยืนยันหมดอายุแล้ว กรุณาติดต่อผู้ดูแลเพื่อขอลิงก์ใหม่", "TOKEN_EXPIRED");
        }

        const verified = await leaderVerificationRepository.verify(record.id, signatureData ?? null);
        if (!verified) return error("เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่", "VERIFICATION_NOT_FOUND");

        const allDone = await checkAllDone(record.expenseClaimId);
        const becameReady = allDone && await leaderVerificationRepository.markReadyForCollection(record.expenseClaimId);
        // Do not announce that a collected/approved claim is ready for collection again.
        if (!allDone || becameReady) notifyClaimant(record.expenseClaimId, allDone).catch(() => undefined);

        return success({ verified: true, allDone, expenseClaimId: record.expenseClaimId });
    },

    /**
     * Verify by authenticated internal leader (userId must match leaderUserId on record).
     */
    async verifyAsInternalLeader(
        expenseClaimId: string,
        offSiteWorkId: string,
        userId: string,
        signatureData?: Buffer | null,
        expectedVerificationId?: string,
    ): Promise<Result<VerifyResult>> {
        if (!expectedVerificationId) {
            return error("เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่", "VERIFICATION_NOT_FOUND");
        }
        const record = await leaderVerificationRepository.findByClaimAndOsw(
            expenseClaimId,
            offSiteWorkId
        );

        if (!record || record.id !== expectedVerificationId) {
            return error("ไม่พบรายการยืนยัน", "VERIFICATION_NOT_FOUND");
        }

        if (record.leaderUserId !== userId) {
            return error("คุณไม่ใช่หัวหน้าที่รับผิดชอบงานนี้", "NOT_LEADER");
        }

        if (record.verifiedAt) {
            return success(
                { verified: true, allDone: true, expenseClaimId },
                "ยืนยันแล้ว"
            );
        }

        if (new Date() > record.expiresAt) {
            return error("ลิงก์ยืนยันหมดอายุแล้ว กรุณาติดต่อผู้ดูแลเพื่อขอลิงก์ใหม่", "TOKEN_EXPIRED");
        }

        const verified = await leaderVerificationRepository.verify(record.id, signatureData ?? null);
        if (!verified) return error("เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่", "VERIFICATION_NOT_FOUND");

        const allDone = await checkAllDone(expenseClaimId);
        const becameReady = allDone && await leaderVerificationRepository.markReadyForCollection(expenseClaimId);
        if (!allDone || becameReady) notifyClaimant(expenseClaimId, allDone).catch(() => undefined);

        return success({ verified: true, allDone, expenseClaimId });
    },

    /**
     * List pending verifications for an internal leader's dashboard.
     */
    async listPendingForLeader(
        userId: string
    ): Promise<Result<LeaderVerificationQueueItem[]>> {
        const records = await leaderVerificationRepository.findPendingByLeaderUserId(userId);
        return success(records);
    },

    /** Read access follows an assigned, still-linked order, regardless of verification expiry. */
    async getClaimDetailForLeader(
        expenseClaimId: string,
        userId: string,
    ): Promise<Result<LeaderClaimDetail>> {
        if (typeof expenseClaimId !== "string" || !expenseClaimId.trim()) {
            return error("ไม่พบเอกสารเบิกที่คุณมีสิทธิ์ตรวจสอบ", "CLAIM_NOT_FOUND");
        }
        const claim = await leaderVerificationRepository.findClaimDetailForLeader(expenseClaimId, userId);
        return claim
            ? success(claim)
            : error("ไม่พบเอกสารเบิกที่คุณมีสิทธิ์ตรวจสอบ", "CLAIM_NOT_FOUND");
    },

    /**
     * Refresh token expiry for a specific verification record.
     * Called when admin wants to re-share an expired link.
     */
    async refreshToken(
        id: string,
        requestingUserId: string
    ): Promise<Result<LeaderVerificationEntity>> {
        const record = await prisma.leaderVerification.findUnique({ where: { id } });
        if (!record) {
            return error("ไม่พบรายการยืนยัน", "VERIFICATION_NOT_FOUND");
        }

        if (record.verifiedAt) {
            return error("ยืนยันแล้ว ไม่สามารถรีเฟรชลิงก์ได้", "ALREADY_VERIFIED");
        }

        const updated = await prisma.leaderVerification.update({
            where: { id },
            data: { token: uuidv7(), expiresAt: makeExpiresAt() },
        });

        void requestingUserId; // for future audit log use

        return success(updated as LeaderVerificationEntity);
    },
};

/**
 * Fire-and-forget: send a notification to the claimant after a leader verifies.
 * Fetches the claim's claimantId from DB to resolve the recipient.
 */
async function notifyClaimant(expenseClaimId: string, allDone: boolean): Promise<void> {
    const claim = await prisma.expenseClaim.findUnique({
        where: { id: expenseClaimId },
        select: { userId: true },
    });
    if (!claim?.userId) return;

    const ns = await getNotificationService();
    if (allDone) {
        await ns.send(
            claim.userId,
            "CLAIM_STATUS_CHANGED",
            "หัวหน้ายืนยันครบทุกใบสั่งแล้ว",
            "เอกสารเบิกค่าตอบแทนของคุณได้รับการยืนยันครบทุกใบสั่งปฏิบัติงานแล้ว และพร้อมรวบรวมเข้าสู่ระบบ",
            `/dashboard?tab=expense-claims&claimId=${expenseClaimId}`,
        );
    } else {
        await ns.send(
            claim.userId,
            "CLAIM_STATUS_CHANGED",
            "หัวหน้ายืนยันใบสั่งปฏิบัติงานแล้ว",
            "หัวหน้ายืนยันใบสั่งปฏิบัติงานของคุณ 1 รายการแล้ว — รอหัวหน้ารายอื่นยืนยันต่อ (ถ้ามี)",
            `/dashboard?tab=expense-claims&claimId=${expenseClaimId}`,
        );
    }
}

/** Returns true when every verification record for the claim has been verified. */
async function checkAllDone(expenseClaimId: string): Promise<boolean> {
    const all = await leaderVerificationRepository.findAllByExpenseClaimId(expenseClaimId);
    if (!all.length) return false;
    return all.every((r) => r.verifiedAt !== null);
}

function dispatchVerificationNotifications(
    created: LeaderVerificationEntity[],
    osws: { id: string; innerRefDocumentId: string | null }[],
    claimantName?: string,
): void {
        // Fire-and-forget: notify internal leaders
        const internalLeaderIds = [
            ...new Set(
                created
                    .filter((r) => r.leaderUserId)
                    .map((r) => r.leaderUserId as string)
            ),
        ];
        if (internalLeaderIds.length > 0) {
            getNotificationService()
                .then((ns) =>
                    ns.sendToMany(
                        internalLeaderIds,
                        "LEADER_VERIFY_REQUEST",
                        "มีคำขอยืนยันการออกปฏิบัติงาน",
                        "พนักงานได้ยื่นเบิกค่าตอบแทนเสี่ยงภัยฯ และรอการยืนยันจากคุณ",
                        "/dashboard?tab=leader-queue",
                    )
                )
                .catch(() => undefined);
        }

        // Fire-and-forget: send email to external leaders
        for (const record of created) {
            if (record.leaderEmail && !record.leaderUserId) {
                const osw = osws.find((o) => o.id === record.offSiteWorkId);
                sendLeaderVerifyEmail({
                    to: record.leaderEmail,
                    token: record.token,
                    offSiteWorkRef: osw?.innerRefDocumentId ?? null,
                    claimantName,
                    expiresAt: record.expiresAt,
                }).catch(() => undefined);
            }
        }


}
