import type { LeaderVerificationPayload } from "./types";

/** Project claimant identity exclusively from the immutable signed payload. */
export function claimantFromVerificationSnapshot(
  payload: LeaderVerificationPayload,
  claimantUserId: string,
) {
  return {
    id: claimantUserId,
    firstName: payload.claim.claimant.firstName,
    lastName: payload.claim.claimant.lastName,
    employeeId: payload.claim.claimant.employeeId,
  };
}
