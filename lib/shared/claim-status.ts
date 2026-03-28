/**
 * Claim Status Helpers
 *
 * Shared badge-variant mapping for `ClaimDocumentStatus`.
 * Each feature page supplies its own label strings (they differ by context /
 * audience), but the colour-coding is identical everywhere.
 *
 * @module lib/shared/claim-status
 */

import type { ClaimDocumentStatus } from "./types";

/**
 * Maps a `ClaimDocumentStatus` value to a shadcn `Badge` variant.
 *
 * - `"default"`     → green-ish (approved / ready)
 * - `"secondary"`   → neutral   (in-progress)
 * - `"destructive"` → red       (rejected / cancelled)
 * - `"outline"`     → subtle    (draft / unknown)
 */
export function claimStatusVariant(
    status: ClaimDocumentStatus,
): "default" | "secondary" | "destructive" | "outline" {
    if (status === "APPROVED" || status === "WAIT_FOR_COLLECTION")
        return "default";
    if (status === "REJECTED" || status === "CANCELLED") return "destructive";
    if (status === "PENDING" || status === "PENDING_LEADER_VERIFY")
        return "secondary";
    return "outline";
}
