import { afterEach, beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  overview: vi.fn(),
  scope: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ can: vi.fn() }));
vi.mock("@/lib/domains/dashboard/service", () => ({
  dashboardService: { getOverview: mock.overview },
}));
vi.mock("@/lib/domains/expense-claim-document/read-scope", () => ({
  resolveClaimReadScope: mock.scope,
}));
vi.mock("@/lib/domains/expense-claim-document", () => ({
  expenseClaimDocumentService: { list: mock.list },
  expenseClaimDocumentRepository: {},
}));
import { getDashboardOverview } from "@/app/actions/dashboard";
import { listExpenseClaimDocuments } from "@/app/actions/expense-claim-document";
afterEach(() => vi.useRealTimers());
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ user: { dbUserId: "me" } });
  mock.overview.mockResolvedValue({ success: true, data: {} });
  mock.list.mockResolvedValue({ success: true, data: [] });
});
it("does not query overview or list when the session expires", async () => {
  mock.auth.mockResolvedValue(null);
  expect(await getDashboardOverview()).toMatchObject({
    success: false,
    code: "UNAUTHORIZED",
  });
  expect(await listExpenseClaimDocuments()).toMatchObject({
    success: false,
    code: "UNAUTHORIZED",
  });
  expect(mock.overview).not.toHaveBeenCalled();
  expect(mock.list).not.toHaveBeenCalled();
});
it("always uses the authenticated subject for overview reads", async () => {
  await getDashboardOverview("2026-09");
  expect(mock.overview).toHaveBeenCalledWith("me", "2026-09");
});
it("defaults the overview to the new Thai month before UTC midnight", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-31T18:00:00Z"));
  await getDashboardOverview();
  expect(mock.overview).toHaveBeenCalledWith("me", "2027-01");
});
it("does not allow an OWN caller to supply another user filter", async () => {
  mock.scope.mockResolvedValue({
    success: true,
    data: { scope: "OWN", userId: "me" },
  });
  await listExpenseClaimDocuments({
    userId: "other",
    status: "PENDING",
    statusGroup: "approved",
    page: 2,
  });
  expect(mock.list).toHaveBeenCalledWith({
    userId: "me",
    status: "PENDING",
    statusGroup: "approved",
    page: 2,
  });
});
it("preserves caller filters for ALL visibility", async () => {
  mock.scope.mockResolvedValue({ success: true, data: { scope: "ALL" } });
  await listExpenseClaimDocuments({ userId: "other", sort: "amount-desc" });
  expect(mock.list).toHaveBeenCalledWith({
    userId: "other",
    sort: "amount-desc",
  });
});
it("preserves permission-denied Result without executing a read", async () => {
  mock.scope.mockResolvedValue({
    success: false,
    error: "Permission denied",
    code: "PERMISSION_DENIED",
  });
  expect(await listExpenseClaimDocuments()).toMatchObject({
    success: false,
    code: "PERMISSION_DENIED",
  });
  expect(mock.list).not.toHaveBeenCalled();
});
