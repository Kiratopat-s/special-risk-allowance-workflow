import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  transaction: vi.fn(), query: vi.fn(), claim: vi.fn(), updateClaim: vi.fn(),
  lookup: vi.fn(), current: vi.fn(), verify: vi.fn(), records: vi.fn(), links: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {
  $transaction: mock.transaction,
  leaderVerification: { findUnique: mock.lookup },
} }));
import { leaderVerificationRepository as repository } from "./repository";
const tx = {
  $queryRaw: mock.query,
  expenseClaim: { findUnique: mock.claim, update: mock.updateClaim },
  leaderVerification: { findUnique: mock.current, update: mock.verify, findMany: mock.records },
  expenseClaimOffSiteWork: { findMany: mock.links },
};
const claim = { id: "claim1", status: "PENDING_LEADER_VERIFY", monthlyRequestCollectionId: null, cancelledAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  mock.transaction.mockImplementation((callback) => callback(tx));
  mock.claim.mockResolvedValue(claim);
  mock.lookup.mockResolvedValue({ expenseClaimId: "claim1" });
  mock.current.mockResolvedValue({ id: "original", expiresAt: new Date(Date.now() + 10000), verifiedAt: null });
  mock.links.mockResolvedValue([{ offSiteWorkId: "work1" }]);
  mock.records.mockResolvedValue([{ offSiteWorkId: "work1", verifiedAt: new Date() }]);
});

describe("signatures serialize with claim edits", () => {
  it("does not sign an ID removed by an edit while waiting for the claim lock", async () => {
    mock.query.mockImplementationOnce(async () => { mock.current.mockResolvedValue(null); return []; });
    expect(await repository.verify("original", Buffer.from("signature"))).toBeNull();
    expect(mock.verify).not.toHaveBeenCalled();
  });

  it("signs the currently valid record only after the claim row is locked", async () => {
    mock.verify.mockResolvedValue({ id: "original" });
    expect(await repository.verify("original", Buffer.from("signature"))).toMatchObject({ id: "original" });
    expect(mock.query.mock.invocationCallOrder[0]).toBeLessThan(mock.current.mock.invocationCallOrder[0]);
    expect(mock.verify).toHaveBeenCalledWith({ where: { id: "original" }, data: { verifiedAt: expect.any(Date), signatureData: new Uint8Array(Buffer.from("signature")) } });
  });

  it("does not mark new unverified date selections ready from an obsolete all-done result", async () => {
    mock.records.mockResolvedValue([{ offSiteWorkId: "work1", verifiedAt: null }]);
    expect(await repository.markReadyForCollection("claim1")).toBe(false);
    expect(mock.updateClaim).not.toHaveBeenCalled();
  });

  it("requires signatures for every currently linked work before marking ready", async () => {
    mock.links.mockResolvedValue([{ offSiteWorkId: "work1" }, { offSiteWorkId: "new-work" }]);
    expect(await repository.markReadyForCollection("claim1")).toBe(false);
    expect(mock.updateClaim).not.toHaveBeenCalled();
  });

  it("marks ready when current signatures cover the current work selection", async () => {
    expect(await repository.markReadyForCollection("claim1")).toBe(true);
    expect(mock.updateClaim).toHaveBeenCalledWith({ where: { id: "claim1" }, data: { status: "WAIT_FOR_COLLECTION" } });
  });

  it("does not reopen a collected claim when its final pending leader signs", async () => {
    mock.claim.mockResolvedValue({ ...claim, status: "COLLECTED", monthlyRequestCollectionId: "collection1" });
    mock.verify.mockResolvedValue({ id: "original" });
    expect(await repository.verify("original")).toMatchObject({ id: "original" });
    expect(await repository.markReadyForCollection("claim1")).toBe(false);
    expect(mock.updateClaim).not.toHaveBeenCalled();
  });
});
