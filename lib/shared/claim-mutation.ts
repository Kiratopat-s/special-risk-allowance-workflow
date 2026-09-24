import type { ClaimDocumentStatus } from "./types";

export const CLAIM_DAILY_RATE = 150;

/** Collection membership locks claim content regardless of the actor's role. */
export function isClaimMutationLocked(claim: {
  status: ClaimDocumentStatus;
  monthlyRequestCollectionId?: string | null;
}): boolean {
  return Boolean(claim.monthlyRequestCollectionId) ||
    ["COLLECTED", "APPROVED", "CANCELLED"].includes(claim.status);
}
