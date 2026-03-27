"use server";

/**
 * User Signature Server Actions
 *
 * All operations are scoped to the authenticated user's own signatures.
 *
 * @module app/actions/user-signature
 */

import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { signatureService } from "@/lib/domains/signature/service";
import { actionLogService } from "@/lib/domains/action-log/service";
import { ActionType } from "@/lib/shared/types";
import type { Result } from "@/lib/shared/types";
import type { SignaturePageState, SignatureViewModel } from "@/lib/domains/signature/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertAuth() {
    const session = await auth();
    if (!session?.user?.dbUserId) return null;
    return session.user.dbUserId;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getMySignatureState(): Promise<Result<SignaturePageState>> {
    const userId = await assertAuth();
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    const allowed = await can(userId, "SIGNATURE", "READ", { targetOwnerId: userId });
    if (!allowed) return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };

    return signatureService.getPageState(userId);
}

// ---------------------------------------------------------------------------
// Create (receives base64 data URL from canvas, converts to Buffer server-side)
// ---------------------------------------------------------------------------

export async function createMySignature(
    dataUrl: string
): Promise<Result<SignatureViewModel>> {
    const userId = await assertAuth();
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    const allowed = await can(userId, "SIGNATURE", "CREATE", { targetOwnerId: userId });
    if (!allowed) return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };

    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
    if (!base64) return { success: false, error: "Invalid image data", code: "INVALID_DATA" };

    const signatureData = Buffer.from(base64, "base64");
    const result = await signatureService.create(userId, { signatureData });

    if (result.success) {
        void actionLogService.log({
            userId,
            actionType: "OTHER" as ActionType,
            actionDescription: "User created a new signature",
            targetEntityType: "Signature",
            targetEntityId: result.data.id,
            isSuccess: true,
        });
    }

    return result;
}

// ---------------------------------------------------------------------------
// Update existing (replace pixel data, keep id in history)
// ---------------------------------------------------------------------------

export async function updateMySignature(
    signatureId: string,
    dataUrl: string
): Promise<Result<SignatureViewModel>> {
    const userId = await assertAuth();
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    const allowed = await can(userId, "SIGNATURE", "UPDATE", { targetOwnerId: userId });
    if (!allowed) return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };

    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
    if (!base64) return { success: false, error: "Invalid image data", code: "INVALID_DATA" };

    const signatureData = Buffer.from(base64, "base64");
    const result = await signatureService.update(signatureId, userId, { signatureData });

    if (result.success) {
        void actionLogService.log({
            userId,
            actionType: "OTHER" as ActionType,
            actionDescription: `User updated signature ${signatureId}`,
            targetEntityType: "Signature",
            targetEntityId: signatureId,
            isSuccess: true,
        });
    }

    return result;
}

// ---------------------------------------------------------------------------
// Activate a historical signature
// ---------------------------------------------------------------------------

export async function activateMySignature(
    signatureId: string
): Promise<Result<SignatureViewModel>> {
    const userId = await assertAuth();
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    const allowed = await can(userId, "SIGNATURE", "UPDATE", { targetOwnerId: userId });
    if (!allowed) return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };

    const result = await signatureService.activate(signatureId, userId);

    if (result.success) {
        void actionLogService.log({
            userId,
            actionType: "OTHER" as ActionType,
            actionDescription: `User activated signature ${signatureId}`,
            targetEntityType: "Signature",
            targetEntityId: signatureId,
            isSuccess: true,
        });
    }

    return result;
}

// ---------------------------------------------------------------------------
// Soft-delete
// ---------------------------------------------------------------------------

export async function deleteMySignature(
    signatureId: string
): Promise<Result<void>> {
    const userId = await assertAuth();
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    const allowed = await can(userId, "SIGNATURE", "DELETE", { targetOwnerId: userId });
    if (!allowed) return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };

    const result = await signatureService.softDelete(signatureId, userId);

    if (result.success) {
        void actionLogService.log({
            userId,
            actionType: "OTHER" as ActionType,
            actionDescription: `User deleted signature ${signatureId}`,
            targetEntityType: "Signature",
            targetEntityId: signatureId,
            isSuccess: true,
        });
    }

    return result;
}
