import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), hasRole: vi.fn(), overview: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/permissions", () => ({ hasRole: mocks.hasRole }));
vi.mock("@/lib/domains/email-delivery", () => ({ emailDeliveryService: {}, emailDashboardService: {
  overview: mocks.overview, list: mocks.list, detail: mocks.detail,
} }));
import { getEmailWorkerOverview, listEmailWorkerJobs, getEmailWorkerJob } from "@/app/actions/email-deliveries";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { dbUserId: "actor" } });
  mocks.hasRole.mockResolvedValue(true);
  for (const operation of [mocks.overview, mocks.list, mocks.detail]) operation.mockResolvedValue({ success: true, data: {} });
});

it.each([false, true])("guards every dashboard action before queries (authenticated=%s)", async (authenticated) => {
  mocks.auth.mockResolvedValue(authenticated ? { user: { dbUserId: "ordinary-admin" } } : null);
  mocks.hasRole.mockResolvedValue(false);
  for (const result of await Promise.all([getEmailWorkerOverview(), listEmailWorkerJobs(), getEmailWorkerJob("job")])) {
    expect(result).toMatchObject({ success: false, code: authenticated ? "PERMISSION_DENIED" : "UNAUTHORIZED" });
  }
  expect(mocks.overview).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.detail).not.toHaveBeenCalled();
});

it("normalizes search and detail IDs and preserves inclusive calendar date filters", async () => {
  await listEmailWorkerJobs({ search: "  หัวหน้า ", status: "FAILED", from: "2026-09-01", to: "2026-09-30", page: 2 });
  expect(mocks.list).toHaveBeenCalledWith({ search: "หัวหน้า", status: "FAILED", from: "2026-09-01", to: "2026-09-30", page: 2 });
  await getEmailWorkerJob(" job ", 2);
  expect(mocks.detail).toHaveBeenCalledWith("job", 2);
  await getEmailWorkerOverview();
  expect(mocks.overview).toHaveBeenCalledOnce();
});

it("rejects malformed dates, pagination, IDs, status and payloads without database access", async () => {
  for (const filter of [null, [], { from: "2026-02-30" }, { from: "0000-01-01" }, { to: "27/09/2026" },
    { from: "2026-09-28", to: "2026-09-27" }, { page: 0 }, { status: "DELIVERED" }, { search: "x".repeat(201) }]) {
    expect(await listEmailWorkerJobs(filter as never)).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  }
  for (const id of [null, " ", "x".repeat(101)]) expect(await getEmailWorkerJob(id as never)).toMatchObject({ success: false });
  for (const page of [0, -1, 1.5, Infinity]) expect(await getEmailWorkerJob("job", page)).toMatchObject({ success: false });
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.detail).not.toHaveBeenCalled();
});
