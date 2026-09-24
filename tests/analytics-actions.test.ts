import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), report: vi.fn(), claims: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/domains/analytics/service", () => ({ analyticsService: { getReport: mocks.report, getClaims: mocks.claims } }));
import { getAnalyticsClaims, getAnalyticsReport } from "@/app/actions/analytics";
import { GET } from "@/app/api/analytics/export/route";

beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { dbUserId: "session-user" } }); });
it("requires authentication for summary, detail, and export independently", async () => {
  mocks.auth.mockResolvedValue(null);
  expect(await getAnalyticsReport()).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  expect(await getAnalyticsClaims()).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  expect((await GET(new Request("https://example.test/api/analytics/export"))).status).toBe(401);
  expect(mocks.report).not.toHaveBeenCalled(); expect(mocks.claims).not.toHaveBeenCalled();
});
it("allows authenticated summary reads without requiring workflow permissions", async () => {
  mocks.report.mockResolvedValue({ success: true, data: {} });
  expect((await getAnalyticsReport("interval=quarter&calendar=fiscal&year=2027&period=1")).success).toBe(true);
  expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ fromMonth: "2026-10", toMonth: "2026-12" }));
});
it("uses the session identity, validates filters before querying, and bounds pagination", async () => {
  await getAnalyticsClaims("userId=other", -10);
  expect(mocks.claims).toHaveBeenCalledWith("session-user", expect.any(Object), 1);
  mocks.claims.mockClear();
  expect(await getAnalyticsClaims("statuses=PAID", 1)).toMatchObject({ success: false });
  expect(mocks.claims).not.toHaveBeenCalled();
  expect((await GET(new Request("https://example.test/api/analytics/export?interval=month&from=invalid"))).status).toBe(400);
});
