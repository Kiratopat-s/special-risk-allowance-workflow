"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import {
  leaderVerificationService,
  type LeaderVerificationWithRelations,
  type VerifyResult,
} from "@/lib/domains/leader-verification";
import { signatureService } from "@/lib/domains/signature";
import type { Result } from "@/lib/shared/types";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const SIGNATURE_DATA_URL = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = SIGNATURE_DATA_URL.exec(dataUrl.trim());
  if (!match) return null;
  const buffer = Buffer.from(match[1], "base64");
  return buffer.length > 0 && buffer.length <= MAX_SIGNATURE_BYTES
    ? buffer
    : null;
}

function signatureBuffer(
  value?: string,
): Result<Buffer | undefined> {
  if (!value) return { success: true, data: undefined };
  const parsed = dataUrlToBuffer(value);
  return parsed
    ? { success: true, data: parsed }
    : {
        success: false,
        error: "รูปแบบลายเซ็นไม่ถูกต้องหรือไฟล์มีขนาดเกิน 2 MB",
        code: "INVALID_SIGNATURE",
      };
}

function revalidateVerificationViews(): void {
  revalidatePath("/expense-claim-document");
  revalidatePath("/leader-verify/pending");
  revalidatePath("/dashboard");
}

export async function getVerificationByToken(
  token: string,
): Promise<Result<LeaderVerificationWithRelations>> {
  return leaderVerificationService.getByRawToken(token);
}

export async function verifyByToken(
  token: string,
  signatureDataUrl?: string,
): Promise<Result<VerifyResult>> {
  if (!token?.trim()) {
    return { success: false, error: "Token is required", code: "INVALID_TOKEN" };
  }
  const signature = signatureBuffer(signatureDataUrl);
  if (!signature.success) return signature;
  const result = await leaderVerificationService.verifyByToken(
    token,
    signature.data,
  );
  if (result.success) revalidateVerificationViews();
  return result;
}

export async function listMyVerifications(
  view: "pending" | "history" | "all" = "all",
): Promise<Result<LeaderVerificationWithRelations[]>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }
  return leaderVerificationService.listForLeader(session.user.dbUserId, view);
}

export async function listMyPendingVerifications(): Promise<
  Result<LeaderVerificationWithRelations[]>
> {
  // Dashboard renders pending first and a collapsible immutable history.
  return listMyVerifications("all");
}

export async function verifyAsLeader(
  claimRevisionId: string,
  revisionOffSiteWorkId: string,
  signatureDataUrl?: string,
): Promise<Result<VerifyResult>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }
  const signature = signatureBuffer(signatureDataUrl);
  if (!signature.success) return signature;
  const result = await leaderVerificationService.verifyAsInternalLeader(
    claimRevisionId,
    revisionOffSiteWorkId,
    session.user.dbUserId,
    signature.data,
  );
  if (result.success) revalidateVerificationViews();
  return result;
}

export async function refreshVerificationToken(
  verificationId: string,
): Promise<Result<void>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }
  const recordResult = await leaderVerificationService.getById(verificationId);
  if (!recordResult.success) {
    return {
      success: false,
      error: "ไม่พบรายการยืนยัน",
      code: "VERIFICATION_NOT_FOUND",
    };
  }
  const record = recordResult.data;
  const canManage = await can(
    session.user.dbUserId,
    "EXPENSE_CLAIM",
    "MANAGE",
    { targetOwnerId: record.expenseClaim.userId },
  );
  const result = await leaderVerificationService.refreshToken(
    verificationId,
    session.user.dbUserId,
    canManage,
  );
  if (result.success) revalidateVerificationViews();
  return result;
}

export async function getMyActiveSignatureDataUrl(): Promise<Result<string | null>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }
  return signatureService.getActiveDataUrl(session.user.dbUserId);
}
