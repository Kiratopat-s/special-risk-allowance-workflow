import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  can: vi.fn(),
  exact: vi.fn(),
  role: vi.fn(),
  scope: vi.fn(),
  claims: vi.fn(),
  collections: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({
  can: mock.can,
  canExact: mock.exact,
  hasRole: mock.role,
}));
vi.mock("@/lib/domains/expense-claim-document/read-scope", () => ({
  resolveClaimReadScope: mock.scope,
}));
vi.mock("./repository", () => ({
  dashboardRepository: { claims: mock.claims, collections: mock.collections },
}));
import { dashboardService } from "./service";
describe("authorized dashboard overview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.can.mockResolvedValue(false);
    mock.exact.mockResolvedValue(false);
    mock.role.mockResolvedValue(false);
    mock.scope.mockResolvedValue({
      success: true,
      data: { scope: "OWN", userId: "me" },
    });
    mock.claims.mockResolvedValue({
      groups: [
        { status: "DRAFT", _count: { _all: 25 }, _sum: { amount: "3750.00" } },
        { status: "APPROVED", _count: { _all: 20 }, _sum: { amount: "3000" } },
        { status: "REJECTED", _count: { _all: 2 }, _sum: { amount: "300" } },
        ...[
          "PENDING",
          "PENDING_LEADER_VERIFY",
          "WAIT_FOR_COLLECTION",
          "COLLECTED",
        ].map((status) => ({
          status,
          _count: { _all: 1 },
          _sum: { amount: "150" },
        })),
      ],
      recent: [],
      requiresAction: 0,
    });
    mock.collections.mockResolvedValue({ total: 0, recent: [] });
  });
  it("sums the complete authorized result, including draft/rejected requested value", async () => {
    const result = await dashboardService.getOverview("me", "2026-09");
    expect(result).toMatchObject({
      success: true,
      data: {
        scope: "OWN",
        claims: {
          total: 51,
          requestedAmount: 7650,
          approvedAmount: 3000,
          inProgress: 4,
          recent: [],
        },
      },
    });
    expect(mock.claims).toHaveBeenCalledWith(
      {
        userId: "me",
        expenseMonthFrom: new Date("2026-09-01T00:00:00Z"),
        expenseMonthTo: new Date("2026-09-30T23:59:59.999Z"),
      },
      null,
    );
  });
  it("does not impose ownership on ALL reads", async () => {
    mock.scope.mockResolvedValue({ success: true, data: { scope: "ALL" } });
    const result = await dashboardService.getOverview("me", "2026-09");
    expect(result).toMatchObject({ success: true, data: { scope: "ALL" } });
    expect(mock.claims.mock.calls[0][0].userId).toBeUndefined();
  });
  it("does not label status alone as requiring action", async () => {
    await dashboardService.getOverview("me", "2026-09");
    expect(mock.claims.mock.calls[0][1]).toBeNull();
  });
  it("restricts actionable documents to ownership when UPDATE is OWN", async () => {
    mock.can.mockImplementation(
      async (_user, resource, action, options) =>
        resource === "EXPENSE_CLAIM" &&
        action === "UPDATE" &&
        options?.targetOwnerId === "me",
    );
    await dashboardService.getOverview("me", "2026-09");
    expect(mock.claims.mock.calls[0][1]).toEqual({
      status: { in: ["DRAFT", "REJECTED"] },
      userId: "me",
    });
  });
  it("hides inaccessible sections without substituting zero", async () => {
    mock.scope.mockResolvedValue({ success: false, code: "PERMISSION_DENIED" });
    expect(await dashboardService.getOverview("me", "2026-09")).toMatchObject({
      success: true,
      data: { scope: "RESTRICTED", claims: null, collections: null },
    });
    expect(mock.claims).not.toHaveBeenCalled();
    expect(mock.collections).not.toHaveBeenCalled();
  });
  it("allows read-only users to access collection visibility without retired reviewer permissions", async () => {
    mock.can.mockImplementation(
      async (_user, resource, action) =>
        resource === "MONTHLY_REQUEST" && action === "LIST",
    );
    mock.exact.mockImplementation(
      async (_user, _resource, action) =>
        action === "REVIEW_RK" || action === "REVIEW_OK",
    );
    await dashboardService.getOverview("me", "2026-09");
    expect(mock.collections.mock.calls[0][2]).toEqual({
      userId: "me",
      ownOnly: false,
      manage: false,
      superAdmin: false,
      hpa: false,
    });
  });
  it("distinguishes loading failure from an empty overview", async () => {
    mock.claims.mockRejectedValue(new Error("database offline"));
    expect(await dashboardService.getOverview("me", "2026-09")).toMatchObject({
      success: false,
      code: "OVERVIEW_READ_FAILED",
    });
  });
  it.each(["2026-13", "2026-00", "2026-9", "bad"])(
    "rejects invalid month %s before querying",
    async (month) => {
      expect(await dashboardService.getOverview("me", month)).toMatchObject({
        success: false,
        code: "INVALID_MONTH",
      });
      expect(mock.claims).not.toHaveBeenCalled();
    },
  );
});
