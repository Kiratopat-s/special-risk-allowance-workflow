import { it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  groupBy: vi.fn().mockResolvedValue([]),
  findMany: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(82),
}));
vi.mock("@/lib/db", () => ({ prisma: { expenseClaim: mock } }));
import { dashboardRepository } from "./repository";
it("uses the same authorization predicate for aggregates and recent rows, limiting only recent rows", async () => {
  const criteria = {
    userId: "me",
    expenseMonthFrom: "2026-09-01",
    expenseMonthTo: "2026-09-30",
  };
  await dashboardRepository.claims(criteria, { userId: "me", status: "DRAFT" });
  expect(mock.groupBy.mock.calls[0][0].where).toEqual(
    mock.findMany.mock.calls[0][0].where,
  );
  expect(mock.groupBy.mock.calls[0][0]).not.toHaveProperty("take");
  expect(mock.groupBy.mock.calls[0][0]).not.toHaveProperty("skip");
  expect(mock.findMany.mock.calls[0][0].take).toBe(6);
  expect(mock.count.mock.calls[0][0].where.AND[0]).toEqual(
    mock.groupBy.mock.calls[0][0].where,
  );
  expect(JSON.stringify(mock.findMany.mock.calls[0][0].select)).not.toMatch(
    /token|signatureData|leaderEmail/,
  );
});
