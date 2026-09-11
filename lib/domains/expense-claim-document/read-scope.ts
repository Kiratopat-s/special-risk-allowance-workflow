import { can } from "@/lib/auth/permissions";
import type { Result } from "@/lib/shared/types";
export type ClaimReadScope =
  | { scope: "ALL"; userId?: undefined }
  | { scope: "OWN"; userId: string };
/** Shared with the existing list action: READ fallback is always own-only. */
export async function resolveClaimReadScope(
  userId: string,
): Promise<Result<ClaimReadScope>> {
  if (
    !(await can(userId, "EXPENSE_CLAIM", "LIST", { targetOwnerId: userId }))
  ) {
    if (
      !(await can(userId, "EXPENSE_CLAIM", "READ", { targetOwnerId: userId }))
    )
      return {
        success: false,
        error: "Permission denied",
        code: "PERMISSION_DENIED",
      };
    return { success: true, data: { scope: "OWN", userId } };
  }
  const all = await can(userId, "EXPENSE_CLAIM", "LIST", {
    targetOwnerId: "00000000-0000-0000-0000-000000000000",
  });
  return {
    success: true,
    data: all ? { scope: "ALL" } : { scope: "OWN", userId },
  };
}
