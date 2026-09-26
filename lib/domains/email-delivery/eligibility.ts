import { z } from "zod";
import type { EmailContext } from "./repository";
import type { InternalLeaderEmailInput } from "@/lib/email/internal-leader";

type Eligibility =
  | { kind: "eligible"; content: Omit<InternalLeaderEmailInput, "deliveryId"> }
  | { kind: "skipped" | "failed"; code: string };

export function evaluateEmailEligibility(context: EmailContext, now = new Date()): Eligibility {
  const { claim, leader, verifications } = context;
  if (!claim || claim.cancelledAt || !["PENDING", "PENDING_LEADER_VERIFY"].includes(claim.status) || claim.monthlyRequestCollectionId) {
    return { kind: "skipped", code: "CLAIM_NO_LONGER_PENDING" };
  }
  const linked = new Set(claim.expenseClaimOffSiteWorks.map((link) => link.offSiteWorkId));
  const pending = verifications.filter((record) =>
    !record.verifiedAt && record.expiresAt > now && !record.offSiteWork.deletedAt && linked.has(record.offSiteWorkId),
  );
  if (!pending.length) return { kind: "skipped", code: "NO_PENDING_VERIFICATIONS" };
  if (!leader || leader.status !== "ACTIVE") return { kind: "failed", code: "RECIPIENT_INACTIVE" };
  const email = leader.email.trim();
  if (!z.email().safeParse(email).success) return { kind: "failed", code: "INVALID_RECIPIENT" };
  return { kind: "eligible", content: {
    to: email,
    claimantName: `${claim.claimant.firstName} ${claim.claimant.lastName}`.trim(),
    expenseMonth: claim.expenseMonth,
    orders: pending.map((record) => ({ reference: record.offSiteWork.innerRefDocumentId, expiresAt: record.expiresAt })),
  } };
}
