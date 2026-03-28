"use server";

/**
 * LeaderVerification Server Actions
 *
 * Public (unauthenticated) and authenticated actions for leader verification flow.
 *
 * @module app/actions/leader-verify
 */

import { auth } from "@/lib/auth";
import { leaderVerificationService } from "@/lib/domains/leader-verification";
import { leaderVerificationRepository } from "@/lib/domains/leader-verification/repository";
import type { Result } from "@/lib/shared/types";
import type {
    LeaderVerificationWithRelations,
    LeaderVerificationEntity,
} from "@/lib/domains/leader-verification";
import type { VerifyResult } from "@/lib/domains/leader-verification";

/**
 * Get verification detail by one-time token (no auth required — public page).
 */
export async function getVerificationByToken(
    token: string
): Promise<Result<LeaderVerificationWithRelations>> {
    if (!token?.trim()) {
        return { success: false, error: "Token is required", code: "INVALID_TOKEN" };
    }

    const record = await leaderVerificationRepository.findByToken(token);
    if (!record) {
        return { success: false, error: "Verification link not found or expired", code: "TOKEN_NOT_FOUND" };
    }

    return { success: true, data: record };
}

/**
 * Verify by one-time token (no auth required — external leader).
 */
export async function verifyByToken(
    token: string
): Promise<Result<VerifyResult>> {
    if (!token?.trim()) {
        return { success: false, error: "Token is required", code: "INVALID_TOKEN" };
    }

    return leaderVerificationService.verifyByToken(token);
}

/**
 * List all pending verifications for the currently logged-in user (internal leader).
 */
export async function listMyPendingVerifications(): Promise<
    Result<LeaderVerificationWithRelations[]>
> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    return leaderVerificationService.listPendingForLeader(
        session.user.dbUserId
    );
}

/**
 * Verify as an internal leader (must be authenticated and matched to the verification record).
 */
export async function verifyAsLeader(
    expenseClaimId: string,
    offSiteWorkId: string
): Promise<Result<VerifyResult>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    return leaderVerificationService.verifyAsInternalLeader(
        expenseClaimId,
        offSiteWorkId,
        session.user.dbUserId
    );
}

/**
 * Refresh (regenerate) a verification token — admin / claimant use.
 */
export async function refreshVerificationToken(
    verificationId: string
): Promise<Result<LeaderVerificationEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    return leaderVerificationService.refreshToken(verificationId, session.user.dbUserId);
}
