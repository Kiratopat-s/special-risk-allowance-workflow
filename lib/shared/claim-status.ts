/**
 * Claim Status Helpers
 *
 * Shared badge-variant mapping for `ExpenseClaimStatus`.
 * Each feature page supplies its own label strings (they differ by context /
 * audience), but the colour-coding is identical everywhere.
 *
 * @module lib/shared/claim-status
 */

import type { ExpenseClaimStatus } from "./types";

/**
 * Maps an `ExpenseClaimStatus` value to a shadcn `Badge` variant.
 *
 * - `"default"`     → green-ish (approved / ready)
 * - `"secondary"`   → neutral   (in-progress)
 * - `"destructive"` → red       (rejected / cancelled)
 * - `"outline"`     → subtle    (draft / unknown)
 */
export function claimStatusVariant(
    status: ExpenseClaimStatus,
): "default" | "secondary" | "destructive" | "outline" {
    if (status === "COMPLETED" || status === "READY_FOR_COLLECTION")
        return "default";
    if (status === "REJECTED" || status === "CANCELLED") return "destructive";
    if (status === "PENDING_LEADER_CONFIRMATION" || status === "COLLECTED")
        return "secondary";
    return "outline";
}
