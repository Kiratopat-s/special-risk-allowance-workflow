import { z } from "zod";
import type { EmailContext } from "./repository";

const nullableText = z.string().nullable();
const nullableTimestamp = z.iso.datetime({ offset: true }).nullable();
const snapshotSchema = z.object({
  version: z.literal(1),
  capturedAt: z.iso.datetime({ offset: true }),
  claimantName: nullableText,
  leaderName: nullableText,
  expenseMonth: nullableTimestamp,
  recipientEmail: nullableText,
  claimStatus: nullableText,
  recipientStatus: nullableText,
  eligibility: z.object({
    kind: z.enum(["queued", "eligible", "skipped", "failed"]),
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/).nullable(),
  }),
  orders: z.array(z.object({
    verificationId: z.string().min(1),
    offSiteWorkId: nullableText,
    reference: nullableText,
    expiresAt: nullableTimestamp,
    state: z.enum(["PENDING", "VERIFIED", "EXPIRED", "UNLINKED", "DELETED", "MISSING"]),
  })),
});

export type EmailContextSnapshot = z.infer<typeof snapshotSchema>;

/** Reject unknown versions/malformed fields and strip any unexpected data. */
export function parseSnapshot(value: unknown): EmailContextSnapshot | null {
  const parsed = snapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The same observations drive both historical metadata and send eligibility. */
export function observeSnapshotOrders(context: EmailContext, now = new Date()): EmailContextSnapshot["orders"] {
  const linked = new Set(context.claim?.expenseClaimOffSiteWorks.map((link) => link.offSiteWorkId) ?? []);
  const records = new Map(context.verifications.map((record) => [record.id, record]));
  return [...new Set(context.verificationIds)].map((verificationId) => {
    const record = records.get(verificationId);
    if (!record) return { verificationId, offSiteWorkId: null, reference: null, expiresAt: null, state: "MISSING" };
    const state = record.offSiteWork.deletedAt ? "DELETED"
      : !linked.has(record.offSiteWorkId) ? "UNLINKED"
      : record.verifiedAt ? "VERIFIED"
      : record.expiresAt <= now ? "EXPIRED" : "PENDING";
    return {
      verificationId,
      offSiteWorkId: record.offSiteWorkId,
      reference: record.offSiteWork.innerRefDocumentId,
      expiresAt: record.expiresAt.toISOString(),
      state,
    };
  });
}

export function createEmailContextSnapshot(
  context: EmailContext,
  eligibility: { kind: EmailContextSnapshot["eligibility"]["kind"]; code?: string | null },
  now = new Date(),
): EmailContextSnapshot {
  return {
    version: 1,
    capturedAt: now.toISOString(),
    claimantName: context.claim ? `${context.claim.claimant.firstName} ${context.claim.claimant.lastName}`.trim() : null,
    leaderName: context.leader ? `${context.leader.firstName} ${context.leader.lastName}`.trim() : null,
    expenseMonth: context.claim?.expenseMonth.toISOString() ?? null,
    recipientEmail: context.leader?.email.trim() ?? null,
    claimStatus: context.claim?.status ?? null,
    recipientStatus: context.leader?.status ?? null,
    eligibility: { kind: eligibility.kind, code: eligibility.code ?? null },
    orders: observeSnapshotOrders(context, now),
  };
}
