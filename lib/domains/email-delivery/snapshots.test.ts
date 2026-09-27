import { describe, expect, it } from "vitest";
import type { EmailContext } from "./repository";
import { createEmailContextSnapshot, observeSnapshotOrders, parseSnapshot } from "./snapshots";
import { evaluateEmailEligibility } from "./eligibility";

const now = new Date("2026-09-27T00:00:00Z");
function record(id = "verify-1"): EmailContext["verifications"][number] {
  return {
    id, offSiteWorkId: `work-${id}`, verifiedAt: null, expiresAt: new Date("2026-09-28T00:00:00Z"),
    offSiteWork: { deletedAt: null, innerRefDocumentId: `REF-${id}` },
  };
}
function context(): EmailContext {
  return {
    verificationIds: ["verify-1"],
    claim: {
      id: "claim-1", status: "PENDING_LEADER_VERIFY", cancelledAt: null, monthlyRequestCollectionId: null,
      expenseMonth: new Date("2026-09-01T00:00:00Z"), claimant: { firstName: "ผู้ยื่น", lastName: "เดิม" },
      expenseClaimOffSiteWorks: [{ offSiteWorkId: "work-verify-1" }],
    },
    leader: { firstName: "หัวหน้า", lastName: "เดิม", email: "leader@example.test", status: "ACTIVE" },
    verifications: [record()],
  };
}

describe("email context snapshots", () => {
  it("captures only requested historical metadata and is independent of later source edits", () => {
    const source = context();
    const snapshot = createEmailContextSnapshot(source, { kind: "queued" }, now);
    source.claim!.claimant.firstName = "ชื่อใหม่";
    source.leader!.email = "new@example.test";
    source.verifications[0].offSiteWork.innerRefDocumentId = "NEW-REF";
    expect(snapshot).toEqual({
      version: 1, capturedAt: now.toISOString(), claimantName: "ผู้ยื่น เดิม", leaderName: "หัวหน้า เดิม",
      expenseMonth: "2026-09-01T00:00:00.000Z", recipientEmail: "leader@example.test",
      claimStatus: "PENDING_LEADER_VERIFY", recipientStatus: "ACTIVE", eligibility: { kind: "queued", code: null },
      orders: [{ verificationId: "verify-1", offSiteWorkId: "work-verify-1", reference: "REF-verify-1", expiresAt: "2026-09-28T00:00:00.000Z", state: "PENDING" }],
    });
  });

  it("observes every original verification while excluding a replacement from the snapshot and email", () => {
    const source = context();
    const pending = record("pending");
    const verified = { ...record("verified"), verifiedAt: now, expiresAt: new Date("2026-09-26") };
    const expired = { ...record("expired"), expiresAt: now };
    const unlinked = record("unlinked");
    const deleted = { ...record("deleted"), offSiteWork: { deletedAt: now, innerRefDocumentId: "DELETED-REF" } };
    source.verificationIds = ["pending", "verified", "expired", "unlinked", "deleted", "missing"];
    source.verifications = [pending, verified, expired, unlinked, deleted, record("replacement")];
    source.claim!.expenseClaimOffSiteWorks = [pending, verified, expired, deleted].map(({ offSiteWorkId }) => ({ offSiteWorkId }));
    expect(observeSnapshotOrders(source, now).map(({ verificationId, state }) => ({ verificationId, state }))).toEqual([
      { verificationId: "pending", state: "PENDING" }, { verificationId: "verified", state: "VERIFIED" },
      { verificationId: "expired", state: "EXPIRED" }, { verificationId: "unlinked", state: "UNLINKED" },
      { verificationId: "deleted", state: "DELETED" }, { verificationId: "missing", state: "MISSING" },
    ]);
    expect(observeSnapshotOrders(source, now).at(-1)).toEqual({
      verificationId: "missing", offSiteWorkId: null, reference: null, expiresAt: null, state: "MISSING",
    });
    expect(evaluateEmailEligibility(source, now)).toMatchObject({ kind: "eligible", content: { orders: [{ reference: "REF-pending" }] } });
  });

  it("records expiry as observed at capture time without rewriting an earlier snapshot", () => {
    const source = context();
    const before = createEmailContextSnapshot(source, evaluateEmailEligibility(source, now), now);
    const later = new Date("2026-09-29T00:00:00Z");
    const after = createEmailContextSnapshot(source, evaluateEmailEligibility(source, later), later);
    expect(before.orders[0].state).toBe("PENDING");
    expect(before.eligibility.kind).toBe("eligible");
    expect(after.orders[0].state).toBe("EXPIRED");
    expect(after.eligibility).toEqual({ kind: "skipped", code: "NO_PENDING_VERIFICATIONS" });
  });

  it("records missing sources truthfully without substituting stale names or replacement rows", () => {
    const source = { ...context(), claim: null, leader: null, verifications: [] };
    const snapshot = createEmailContextSnapshot(source, evaluateEmailEligibility(source, now), now);
    expect(snapshot).toMatchObject({
      claimantName: null, leaderName: null, recipientEmail: null, expenseMonth: null,
      claimStatus: null, recipientStatus: null, eligibility: { kind: "skipped", code: "CLAIM_NO_LONGER_PENDING" },
      orders: [{ verificationId: "verify-1", state: "MISSING" }],
    });
  });

  it("strips unknown properties at every level rather than exposing tokens or message bodies", () => {
    const snapshot = createEmailContextSnapshot(context(), { kind: "eligible" }, now);
    expect(parseSnapshot({
      ...snapshot, token: "secret", html: "private mail body",
      eligibility: { ...snapshot.eligibility, rawSmtpResponse: "private response" },
      orders: snapshot.orders.map((order) => ({ ...order, signatureData: "private signature" })),
    })).toEqual(snapshot);
  });

  it.each([
    null, undefined, {}, [], { version: 2 },
    { ...createEmailContextSnapshot(context(), { kind: "queued" }, now), capturedAt: "not-a-date" },
    { ...createEmailContextSnapshot(context(), { kind: "queued" }, now), claimantName: 42 },
    { ...createEmailContextSnapshot(context(), { kind: "queued" }, now), eligibility: { kind: "failed", code: "SMTP response including secret" } },
    { ...createEmailContextSnapshot(context(), { kind: "queued" }, now), orders: [{ verificationId: "x", state: "UNKNOWN" }] },
  ])("returns no historical snapshot for absent or malformed data: %j", (value) => {
    expect(parseSnapshot(value)).toBeNull();
  });
});
