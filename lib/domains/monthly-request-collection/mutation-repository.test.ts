import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  transaction: vi.fn(), query: vi.fn(), findCollection: vi.fn(), updateClaims: vi.fn(), aggregate: vi.fn(), updateCollection: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mock.transaction } }));
import { monthlyRequestCollectionRepository as repository } from "./repository";
const collection = { id: "collection1", status: "DRAFT", collectForMonth: new Date("2026-09-01") };
const tx = {
  $queryRaw: mock.query,
  monthlyRequestCollection: { findUnique: mock.findCollection, update: mock.updateCollection },
  expenseClaim: { updateMany: mock.updateClaims, aggregate: mock.aggregate },
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.transaction.mockImplementation((callback) => callback(tx));
  mock.findCollection.mockResolvedValue(collection);
  mock.query.mockResolvedValue([{ id: "claim1", status: "PENDING_LEADER_VERIFY", expenseMonth: new Date("2026-09-01") }]);
  mock.aggregate.mockResolvedValue({ _sum: { countDates: 2, amount: 300 } });
  mock.updateCollection.mockResolvedValue(collection);
});

describe("collection rechecks the current claim month under lock", () => {
  it("rejects a stale September selection after an owner moved the claim to October without changing other links or totals", async () => {
    mock.query.mockResolvedValueOnce([{ id: "collection1" }]).mockResolvedValueOnce([
      { id: "claim1", status: "PENDING_LEADER_VERIFY", expenseMonth: new Date("2026-10-01") },
    ]);
    expect(await repository.setExpenseClaims("collection1", ["claim1"]))
      .toMatchObject({ success: false, code: "CLAIM_MONTH_MISMATCH" });
    expect(mock.updateClaims).not.toHaveBeenCalled();
    expect(mock.aggregate).not.toHaveBeenCalled();
    expect(mock.updateCollection).not.toHaveBeenCalled();
    const lockedSelectionQuery = mock.query.mock.calls[1][0];
    expect(lockedSelectionQuery.sql).toContain('expense_month AS "expenseMonth"');
    expect(lockedSelectionQuery.sql).toContain("FOR UPDATE");
  });

  it.each(["PENDING", "PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION", "COLLECTED"])("preserves existing %s collection eligibility for claims in the same month", async (status) => {
    mock.query.mockResolvedValueOnce([{ id: "collection1" }]).mockResolvedValueOnce([
      { id: "claim1", status, expenseMonth: new Date("2026-09-01") },
    ]);
    expect((await repository.setExpenseClaims("collection1", ["claim1"])).success).toBe(true);
    expect(mock.updateClaims).toHaveBeenCalledTimes(2);
    expect(mock.aggregate).toHaveBeenCalledOnce();
    expect(mock.query.mock.invocationCallOrder[1]).toBeLessThan(mock.updateClaims.mock.invocationCallOrder[0]);
  });

  it("retains the existing unsent-draft rejection", async () => {
    mock.query.mockResolvedValueOnce([{ id: "collection1" }]).mockResolvedValueOnce([
      { id: "claim1", status: "DRAFT", expenseMonth: new Date("2026-09-01") },
    ]);
    expect(await repository.setExpenseClaims("collection1", ["claim1"])).toMatchObject({ code: "CLAIM_NOT_SUBMITTED" });
    expect(mock.updateClaims).not.toHaveBeenCalled();
  });
});
