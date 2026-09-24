import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  transaction: vi.fn(), query: vi.fn(), findClaim: vi.fn(), createClaim: vi.fn(), updateClaim: vi.fn(),
  findLinks: vi.fn(), findWorks: vi.fn(), deleteVerifications: vi.fn(), claimant: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mock.transaction } }));
import { expenseClaimDocumentRepository as repository } from "./repository";

const work = { id: "work1", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-30"), hasLeader: true };
const claim = {
  id: "claim1", userId: "user1", createdById: "user1", expenseMonth: new Date("2026-09-01"),
  claimantPositionAtSubmission: "Engineer", selectedDates: ["2026-09-01"], countDates: 1, amount: 150,
  status: "WAIT_FOR_COLLECTION", monthlyRequestCollectionId: null, cancelledAt: null, collectedAt: null,
  departmentSnapshotId: "dept1", departmentSnapshotCapturedAt: new Date("2026-09-01"), departmentSnapshotSource: "SUBMISSION",
  remark: null,
};
const tx = {
  $queryRaw: mock.query,
  expenseClaim: { findUnique: mock.findClaim, create: mock.createClaim, update: mock.updateClaim },
  expenseClaimOffSiteWork: { findMany: mock.findLinks },
  offSiteWork: { findMany: mock.findWorks },
  leaderVerification: { deleteMany: mock.deleteVerifications },
  user: { findUniqueOrThrow: mock.claimant },
};
const input = { expenseMonth: "2026-09-01", claimantPositionAtSubmission: "Engineer", offSiteWorkIds: ["work1"], selectedDates: ["2026-09-02"] };

beforeEach(() => {
  vi.resetAllMocks();
  mock.transaction.mockImplementation((callback) => callback(tx));
  mock.query.mockResolvedValue([work]);
  mock.findClaim.mockResolvedValue({ ...claim });
  mock.findLinks.mockResolvedValue([{ offSiteWorkId: "work1" }]);
  mock.findWorks.mockResolvedValue([{ id: "work1", leaderUserId: "leader1", leaderEmail: null }]);
  mock.updateClaim.mockImplementation(({ data }) => Promise.resolve({ ...claim, ...data }));
  mock.createClaim.mockImplementation(({ data }) => Promise.resolve({ ...claim, ...data }));
  mock.claimant.mockResolvedValue({ department: { id: "dept1", name: "Department", shortName: "D" } });
});

describe("atomic claim selection mutations", () => {
  it("ignores tampered totals on creation and stores unique dates plus verifications atomically", async () => {
    const result = await repository.createWithSelection({ ...input, selectedDates: ["2026-09-02", "2026-09-02"], countDates: 99, amount: 999999, status: "PENDING" }, "user1", "user1");
    expect(result).toMatchObject({ success: true, data: { claim: { countDates: 1, amount: 150, status: "PENDING_LEADER_VERIFY" } } });
    expect(mock.createClaim.mock.calls[0][0].data.leaderVerifications.create).toHaveLength(1);
    expect(mock.transaction).toHaveBeenCalledOnce();
  });

  it("keeps a new draft with assigned leaders in DRAFT and does not create verifications", async () => {
    expect(await repository.createWithSelection({ ...input, status: "DRAFT" }, "user1", "user1")).toMatchObject({ success: true, data: { claim: { status: "DRAFT" }, verificationsReset: false } });
    expect(mock.createClaim.mock.calls[0][0].data).not.toHaveProperty("leaderVerifications");
    expect(mock.claimant).not.toHaveBeenCalled();
  });

  it("replaces signatures and resets a submitted date edit even when the day count is unchanged", async () => {
    const result = await repository.updateEditable("claim1", { selectedDates: ["2026-09-02"], offSiteWorkIds: ["work1"], countDates: 100, amount: 10000 });
    expect(result).toMatchObject({ success: true, data: { verificationsReset: true, claim: { selectedDates: ["2026-09-02"], countDates: 1, amount: 150, status: "PENDING_LEADER_VERIFY" } } });
    expect(mock.deleteVerifications).toHaveBeenCalledWith({ where: { expenseClaimId: "claim1" } });
    expect(mock.updateClaim.mock.calls[0][0].data.leaderVerifications.create).toHaveLength(1);
    expect(mock.query.mock.invocationCallOrder[0]).toBeLessThan(mock.findClaim.mock.invocationCallOrder[0]);
    expect(mock.deleteVerifications.mock.invocationCallOrder[0]).toBeLessThan(mock.updateClaim.mock.invocationCallOrder[0]);
    expect(mock.claimant).not.toHaveBeenCalled();
  });

  it("preserves confirmations for unchanged dates/works and a remark-only change", async () => {
    const result = await repository.updateEditable("claim1", { selectedDates: ["2026-09-01", "2026-09-01"], offSiteWorkIds: ["work1"], remark: "New remark", countDates: 999, amount: 0 });
    expect(result).toMatchObject({ success: true, data: { verificationsReset: false, claim: { status: "WAIT_FOR_COLLECTION", countDates: 1, amount: 150 } } });
    expect(mock.deleteVerifications).not.toHaveBeenCalled();
    expect(mock.updateClaim.mock.calls[0][0].data).not.toHaveProperty("leaderVerifications");
  });

  it("restarts confirmation when the work changes even if the dates and amount stay the same", async () => {
    mock.query.mockResolvedValue([{ ...work, id: "work2" }]);
    mock.findWorks.mockResolvedValue([{ id: "work2", leaderUserId: "leader2", leaderEmail: null }]);
    expect(await repository.updateEditable("claim1", { selectedDates: ["2026-09-01"], offSiteWorkIds: ["work2"] }))
      .toMatchObject({ success: true, data: { verificationsReset: true, claim: { status: "PENDING_LEADER_VERIFY" } } });
    expect(mock.updateClaim.mock.calls[0][0].data.leaderVerifications.create[0]).toMatchObject({ offSiteWorkId: "work2", leaderUserId: "leader2" });
  });

  it("rejects a leader removed during validation before invalidating the prior signatures", async () => {
    mock.findWorks.mockResolvedValue([{ id: "work1", leaderUserId: null, leaderEmail: null }]);
    expect(await repository.updateEditable("claim1", { selectedDates: ["2026-09-02"] }))
      .toMatchObject({ code: "OSW_MISSING_LEADER" });
    expect(mock.updateClaim).not.toHaveBeenCalled();
    expect(mock.deleteVerifications).not.toHaveBeenCalled();
  });

  it("clears stale draft dates and totals when the selection is removed", async () => {
    mock.findClaim.mockResolvedValue({ ...claim, status: "DRAFT" });
    expect(await repository.updateEditable("claim1", { selectedDates: [], offSiteWorkIds: [], countDates: 50, amount: 5000 }))
      .toMatchObject({ success: true, data: { claim: { status: "DRAFT", selectedDates: [], countDates: 0, amount: 0 } } });
    expect(mock.updateClaim.mock.calls[0][0].data.expenseClaimOffSiteWorks).toEqual({ deleteMany: {}, create: [] });
  });

  it.each([
    { status: "COLLECTED" }, { status: "APPROVED" }, { status: "CANCELLED" },
    { status: "WAIT_FOR_COLLECTION", monthlyRequestCollectionId: "collection1" },
  ])("locks edits and cancellation for %j regardless of actor privileges", async (locked) => {
    mock.findClaim.mockResolvedValue({ ...claim, ...locked });
    expect(await repository.updateEditable("claim1", input)).toMatchObject({ code: "CLAIM_LOCKED" });
    expect(await repository.cancelEditable("claim1")).toMatchObject({ code: "CLAIM_LOCKED" });
    expect(mock.updateClaim).not.toHaveBeenCalled();
    expect(mock.deleteVerifications).not.toHaveBeenCalled();
  });

  it.each(["edit", "cancel"])("rechecks collection membership after waiting for the %s lock", async (mutation) => {
    mock.query.mockImplementationOnce(async () => {
      mock.findClaim.mockResolvedValue({ ...claim, status: "COLLECTED", monthlyRequestCollectionId: "collector-won-race" });
      return [{ id: "claim1" }];
    });
    const result = mutation === "edit" ? await repository.updateEditable("claim1", input) : await repository.cancelEditable("claim1");
    expect(result).toMatchObject({ code: "CLAIM_LOCKED" });
    expect(mock.updateClaim).not.toHaveBeenCalled();
  });

  it("rejects status and collection-field bypasses without writing anything", async () => {
    for (const data of [{ status: "DRAFT" as const }, { monthlyRequestCollectionId: null }, { collectedAt: null }]) {
      expect(await repository.updateEditable("claim1", data)).toMatchObject({ code: "INVALID_CLAIM_UPDATE" });
    }
    expect(mock.updateClaim).not.toHaveBeenCalled();
  });

  it("rejects missing/ineligible works and out-of-range dates before resetting signatures", async () => {
    expect(await repository.updateEditable("claim1", { selectedDates: ["2026-09-31"] })).toMatchObject({ code: "INVALID_SELECTED_DATES" });
    expect(await repository.updateEditable("claim1", { selectedDates: ["2026-10-01"] })).toMatchObject({ code: "SELECTED_DATE_OUTSIDE_MONTH" });
    expect(await repository.updateEditable("claim1", { offSiteWorkIds: ["not-eligible"] })).toMatchObject({ code: "INELIGIBLE_OFF_SITE_WORK" });
    expect(mock.deleteVerifications).not.toHaveBeenCalled();
    expect(mock.updateClaim).not.toHaveBeenCalled();
  });

  it("recalculates legacy draft totals at submission and captures the department once", async () => {
    mock.findClaim.mockResolvedValue({ ...claim, status: "DRAFT", amount: 9999, countDates: 50, departmentSnapshotCapturedAt: null, departmentSnapshotSource: null });
    expect(await repository.submitDraftWithSelection("claim1", "user1"))
      .toMatchObject({ success: true, data: { claim: { countDates: 1, amount: 150, status: "PENDING_LEADER_VERIFY", departmentSnapshotSource: "SUBMISSION" } } });
    expect(mock.claimant).toHaveBeenCalledOnce();
    expect(mock.updateClaim.mock.calls[0][0].data.leaderVerifications.create).toHaveLength(1);
  });

  it("rejects repeated draft submissions and non-owner submissions under the lock", async () => {
    expect(await repository.submitDraftWithSelection("claim1", "user1")).toMatchObject({ code: "INVALID_STATUS" });
    mock.findClaim.mockResolvedValue({ ...claim, status: "DRAFT" });
    expect(await repository.submitDraftWithSelection("claim1", "someone-else")).toMatchObject({ code: "FORBIDDEN" });
    expect(mock.updateClaim).not.toHaveBeenCalled();
  });

  it("cancels an unlocked claim while preserving its verification audit records", async () => {
    expect(await repository.cancelEditable("claim1")).toMatchObject({ success: true });
    expect(mock.updateClaim).toHaveBeenCalledWith({ where: { id: "claim1" }, data: { status: "CANCELLED", cancelledAt: expect.any(Date) } });
    expect(mock.deleteVerifications).not.toHaveBeenCalled();
  });
});
