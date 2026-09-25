import type { TokenVerificationView } from "@/lib/domains/leader-verification";
import { leaderQueueClaimDetail, leaderQueueItems, secondLeaderQueueClaimDetail } from "./leader-queue";

type ReadyView = Extract<TokenVerificationView, { state: "ready" }>;

function publicClaim(claim: typeof leaderQueueClaimDetail): ReadyView["expenseClaim"] {
  return {
    ...claim,
    claimant: {
      firstName: claim.claimant.firstName,
      lastName: claim.claimant.lastName,
      employeeId: claim.claimant.employeeId,
    },
    expenseClaimOffSiteWorks: claim.expenseClaimOffSiteWorks.map(({ offSiteWorkId, offSiteWork }) => ({
      offSiteWorkId,
      offSiteWork: {
        id: offSiteWork.id,
        innerRefDocumentId: offSiteWork.innerRefDocumentId,
        startDate: offSiteWork.startDate,
        endDate: offSiteWork.endDate,
        location: offSiteWork.location,
        objective: offSiteWork.objective,
      },
    })),
  };
}

const target = leaderQueueItems[0].offSiteWork;

/** Two overlapping orders share five saved dates; the token confirms only the first. */
export const tokenVerificationReady: ReadyView = {
  state: "ready",
  id: "verification-fixture-1",
  offSiteWorkId: target.id,
  expiresAt: new Date("2099-12-31T23:59:59Z"),
  expenseClaim: publicClaim(leaderQueueClaimDetail),
  offSiteWork: {
    id: target.id,
    innerRefDocumentId: target.innerRefDocumentId,
    startDate: target.startDate,
    endDate: target.endDate,
    location: target.location,
    objective: target.objective,
    leaderFirstName: target.leaderFirstName,
    leaderLastName: target.leaderLastName,
    leaderPosition: target.leaderPosition,
  },
};

export const secondTokenVerificationReady: ReadyView = {
  ...tokenVerificationReady,
  id: "verification-fixture-3",
  expenseClaim: publicClaim(secondLeaderQueueClaimDetail),
};

export const tokenVerificationReceipt: Extract<TokenVerificationView, { state: "already_verified" }> = {
  state: "already_verified",
  offSiteWorkId: target.id,
  verifiedAt: new Date("2026-09-18T08:00:00Z"),
};
