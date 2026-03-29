"use server";

/**
 * LeaderVerification Server Actions
 *
 * Public (unauthenticated) and authenticated actions for leader verification flow.
 *
 * @module app/actions/leader-verify
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { leaderVerificationService } from "@/lib/domains/leader-verification";
import { leaderVerificationRepository } from "@/lib/domains/leader-verification/repository";
import { signatureRepository } from "@/lib/domains/signature/repository";
import type { Result } from "@/lib/shared/types";
import type {
    LeaderVerificationWithRelations,
    LeaderVerificationEntity,
} from "@/lib/domains/leader-verification";
import type { VerifyResult } from "@/lib/domains/leader-verification";

/**
 * Convert base64 dataUrl (from canvas) to a Buffer. Returns null for invalid input.
 */
function dataUrlToBuffer(dataUrl: string): Buffer | null {
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
    if (!base64) return null;
    return Buffer.from(base64, "base64");
}

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
 * Accepts an optional base64 dataUrl of the leader's drawn signature.
 */
export async function verifyByToken(
    token: string,
    signatureDataUrl?: string
): Promise<Result<VerifyResult>> {
    if (!token?.trim()) {
        return { success: false, error: "Token is required", code: "INVALID_TOKEN" };
    }

    const signatureData = signatureDataUrl ? dataUrlToBuffer(signatureDataUrl) : null;
    const result = await leaderVerificationService.verifyByToken(token, signatureData ?? undefined);
    if (result.success) revalidatePath("/expense-claim-document");
    return result;
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
 * Accepts an optional base64 dataUrl of the leader's drawn signature.
 */
export async function verifyAsLeader(
    expenseClaimId: string,
    offSiteWorkId: string,
    signatureDataUrl?: string
): Promise<Result<VerifyResult>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const signatureData = signatureDataUrl ? dataUrlToBuffer(signatureDataUrl) : null;
    const result = await leaderVerificationService.verifyAsInternalLeader(
        expenseClaimId,
        offSiteWorkId,
        session.user.dbUserId,
        signatureData ?? undefined
    );
    if (result.success) revalidatePath("/expense-claim-document");
    return result;
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

/**
 * Return the currently logged-in user's active signature as a base64 PNG data URL.
 * Returns null data when the user has no saved signature.
 */
export async function getMyActiveSignatureDataUrl(): Promise<Result<string | null>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const sig = await signatureRepository.findActiveByUserId(session.user.dbUserId);
    if (!sig) {
        return { success: true, data: null };
    }

    const base64 = Buffer.from(sig.signatureData as Uint8Array).toString("base64");
    return { success: true, data: `data:image/png;base64,${base64}` };
}
