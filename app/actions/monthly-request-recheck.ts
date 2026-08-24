"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import {
  monthlyRequestRecheckService,
  type FlagClaimInput,
  type MonthlyRequestRecheckDetail,
  type MonthlyRequestRecheckOverview,
  type RecheckMutationResult,
  type RejectClaimInput,
  type RemoveCollectedClaimInput,
  type ResolveClaimFlagInput,
} from "@/lib/domains/monthly-request-recheck";
import type { PermissionAction, Result } from "@/lib/shared/types";

const ALL_SCOPE_SENTINEL = "00000000-0000-0000-0000-000000000000";

async function authorizedActor(
  action: PermissionAction,
): Promise<{ userId: string } | { error: Result<never> }> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) {
    return {
      error: { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
    };
  }

  const allowed = await can(userId, "EXPENSE_CLAIM", action, {
    targetOwnerId: ALL_SCOPE_SENTINEL,
  });
  if (!allowed) {
    return {
      error: {
        success: false,
        error: "Permission denied",
        code: "PERMISSION_DENIED",
      },
    };
  }
  return { userId };
}

function refreshRecheck(offSiteWorkId?: string): void {
  revalidatePath("/monthly-request-recheck");
  if (offSiteWorkId) {
    revalidatePath(`/monthly-request-recheck/${offSiteWorkId}`);
  }
  revalidatePath("/monthly-request-collection");
  revalidatePath("/dashboard");
}

export async function getMonthlyRequestRecheckOverview(
  month: string,
  departmentId?: string,
): Promise<Result<MonthlyRequestRecheckOverview>> {
  const actor = await authorizedActor("RECHECK");
  if ("error" in actor) return actor.error;
  return monthlyRequestRecheckService.getOverview(month, departmentId);
}

export async function getMonthlyRequestRecheckOffSiteWorkDetail(
  offSiteWorkId: string,
  month: string,
  departmentId?: string,
): Promise<Result<MonthlyRequestRecheckDetail>> {
  const actor = await authorizedActor("RECHECK");
  if ("error" in actor) return actor.error;
  return monthlyRequestRecheckService.getOffSiteWorkDetail(
    offSiteWorkId,
    month,
    departmentId,
  );
}

export async function passClaimIntoMonthlyRequest(
  claimId: string,
  expectedRevisionNo: number,
  month: string,
  offSiteWorkId?: string,
): Promise<Result<RecheckMutationResult>> {
  const actor = await authorizedActor("COLLECT");
  if ("error" in actor) return actor.error;
  const result = await monthlyRequestRecheckService.passClaim(
    claimId,
    actor.userId,
    month,
    expectedRevisionNo,
  );
  if (result.success) refreshRecheck(offSiteWorkId);
  return result;
}

export async function rejectClaimFromRecheck(
  input: RejectClaimInput,
  offSiteWorkId?: string,
): Promise<Result<RecheckMutationResult>> {
  const actor = await authorizedActor("REJECT");
  if ("error" in actor) return actor.error;
  const result = await monthlyRequestRecheckService.rejectClaim(input, actor.userId);
  if (result.success) refreshRecheck(offSiteWorkId);
  return result;
}

export async function markClaimSuspicious(
  input: FlagClaimInput,
  offSiteWorkId?: string,
): Promise<Result<RecheckMutationResult>> {
  const actor = await authorizedActor("FLAG");
  if ("error" in actor) return actor.error;
  const result = await monthlyRequestRecheckService.flagClaim(input, actor.userId);
  if (result.success) refreshRecheck(offSiteWorkId);
  return result;
}

export async function resolveClaimSuspiciousFlag(
  input: ResolveClaimFlagInput,
  offSiteWorkId?: string,
): Promise<Result<RecheckMutationResult>> {
  const actor = await authorizedActor("RESOLVE");
  if ("error" in actor) return actor.error;
  const result = await monthlyRequestRecheckService.resolveFlag(input, actor.userId);
  if (result.success) refreshRecheck(offSiteWorkId);
  return result;
}

export async function removeClaimFromDraftMonthlyRequest(
  input: RemoveCollectedClaimInput,
  offSiteWorkId?: string,
): Promise<Result<RecheckMutationResult>> {
  const actor = await authorizedActor("REMOVE");
  if ("error" in actor) return actor.error;
  const result = await monthlyRequestRecheckService.removeFromDraft(input, actor.userId);
  if (result.success) refreshRecheck(offSiteWorkId);
  return result;
}
