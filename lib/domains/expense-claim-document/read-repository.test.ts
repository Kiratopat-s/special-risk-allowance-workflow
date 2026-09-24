import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  user: vi.fn(), claim: vi.fn(), list: vi.fn(), count: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: mock.user },
  expenseClaim: { findUnique: mock.claim, findMany: mock.list, count: mock.count },
} }));
import { claimReadRepository } from "./read-repository";
import { expenseClaimDocumentRepository } from "./repository";

beforeEach(() => {
  vi.resetAllMocks();
  mock.list.mockResolvedValue([]);
  mock.count.mockResolvedValue(42);
});

it("fetches only access metadata before claim READ authorization", async () => {
  await claimReadRepository.findClaimTarget("claim");
  expect(mock.claim).toHaveBeenCalledWith({
    where: { id: "claim" },
    select: {
      id: true, userId: true, status: true,
      claimant: { select: { departmentId: true } },
    },
  });
});

it("intersects trusted department access with filters before both pagination and count", async () => {
  const visibility = { claimant: { departmentId: { in: ["allowed"] } } };
  await expenseClaimDocumentRepository.findMany({ userId: "other", search: "query", page: 2, pageSize: 20 }, visibility);
  const query = mock.list.mock.calls[0][0];
  expect(query.where.AND[1]).toEqual(visibility);
  expect(query.where.AND[0]).toMatchObject({ userId: "other", cancelledAt: null });
  expect(query.where.AND[0].OR).toBeDefined();
  expect(mock.count).toHaveBeenCalledWith({ where: query.where });
  expect(query.skip).toBe(20);
  expect(query.take).toBe(20);
});
