import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ report: vi.fn(), claims: vi.fn(), access: vi.fn() }));
vi.mock("./repository", () => ({ analyticsRepository: { report: mocks.report, claims: mocks.claims } }));
vi.mock("@/lib/domains/expense-claim-document/read-scope", () => ({ resolveAnalyticsClaimScope: mocks.access }));
import { analyticsService, assembleReport, emptyMetrics, serializeMetrics } from "./service";
import { parseAnalyticsQuery } from "./query";
import type { AnalyticsGroup } from "./repository";
import { formatMoney, sortedRows } from "./format";
import { csvCell, reportCsv } from "./export";
const filtersResult = parseAnalyticsQuery(new URLSearchParams("year=2026"));
if (!filtersResult.success) throw new Error("Invalid test filters");
const filters = filtersResult.data;
const group = (kind: AnalyticsGroup["kind"], key: string | null): AnalyticsGroup => ({ ...emptyMetrics(), kind, key, status: null, label: null });

beforeEach(() => vi.resetAllMocks());
describe("analytics aggregation projection", () => {
  it("retains decimal precision, distinguishes unknown amounts, and emits aggregate fields only", () => {
    const metrics = { ...emptyMetrics(), requested: { count: 3, amount: "9007199254740993.15", missingAmountCount: 1 }, total: { count: 3, amount: null, missingAmountCount: 3 } };
    expect(serializeMetrics(metrics).requested.amount).toBe("9007199254740993.15");
    expect(serializeMetrics(metrics).total.amount).toBeNull();
    expect(formatMoney("9007199254740993.15")).toBe("9,007,199,254,740,993.15");
  });
  it("fills empty months and all statuses without summing distinct people across periods", () => {
    const total = { ...group("total", null), claimantCount: 1 };
    const jan = { ...group("month", "2026-01"), claimantCount: 1 };
    const feb = { ...group("month", "2026-02"), claimantCount: 1 };
    const report = assembleReport(filters, { groups: [total, jan, feb], departmentOptions: [], generatedAt: "2026-09-24T00:00:00Z" }, "2026-09");
    expect(report.summary.claimantCount).toBe(1);
    expect(report.months).toHaveLength(12);
    expect(report.months[2].requested).toEqual({ count: 0, amount: "0.00", missingAmountCount: 0 });
    expect(report.months[9].future).toBe(true);
    expect(report.statuses).toHaveLength(8);
    expect(Object.keys(report.months[0].statuses)).toHaveLength(8);
    expect(report.summary).not.toHaveProperty("kind");
  });
  it("keeps summary access independent of claim permissions and restricts individual rows", async () => {
    mocks.access.mockResolvedValue({ success: false, error: "Denied" });
    expect(await analyticsService.getClaims("employee", filters, 1)).toMatchObject({ success: true, data: { total: 0, items: [], restricted: true } });
    expect(mocks.claims).not.toHaveBeenCalled();
    mocks.report.mockResolvedValue({ groups: [], departmentOptions: [], generatedAt: "2026-09-24T00:00:00Z" });
    expect((await analyticsService.getReport(filters)).success).toBe(true);
  });
  it("passes a trusted AND scope and keeps a captured unassigned department after transfer", async () => {
    const where = { AND: [{ userId: "employee" }, { claimant: { departmentId: "dept" } }] };
    mocks.access.mockResolvedValue({ success: true, data: { scope: "DEPARTMENT", where } });
    mocks.claims.mockResolvedValue({ total: 1, page: 1, items: [{ id: "allowed", expenseMonth: new Date("2026-01-01"), status: "APPROVED", cancelledAt: null,
      amount: { toFixed: () => "150.50" }, departmentSnapshotSource: "SUBMISSION", departmentSnapshotName: null,
      claimant: { firstName: "Test", lastName: "Person", department: { name: "New department" } } }] });
    const result = await analyticsService.getClaims("employee", filters, 5);
    expect(mocks.claims).toHaveBeenCalledWith(filters, where, 5);
    expect(result).toMatchObject({ success: true, data: { page: 1, items: [{ departmentName: "ไม่ระบุแผนก", amount: "150.50" }] } });
  });
});

describe("summary export", () => {
  it("escapes formulas, quotes, whitespace and multiline data", () => {
    expect(csvCell(" =HYPERLINK(\"bad\")")).toBe('"\' =HYPERLINK(""bad"")"');
    expect(csvCell("@SUM(1)")).toBe('"\'@SUM(1)"');
    expect(csvCell("แผนก\nใหม่")).toBe('"แผนก\nใหม่"');
  });
  it("exports all aggregate rows and one distinct total without personal identifiers", () => {
    const report = assembleReport(filters, { groups: [{ ...group("total", null), claimantCount: 1 }], departmentOptions: [], generatedAt: "2026-09-24T00:00:00Z" }, "2026-09");
    const csv = reportCsv(report, "month", "label");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("ยังไม่ถึงช่วงเวลา");
    expect(csv).toContain("รวมทั้งหมด (ผู้ขอเบิกนับไม่ซ้ำ)");
    expect(csv).not.toMatch(/claimantName|employeeId|signature|remark|user_id/);
  });
  it("sorts large monetary amounts precisely and leaves missing values last", () => {
    const rows = ["9007199254740993.15", null, "9007199254740993.16"].map((amount, i) => ({ ...emptyMetrics(), key: String(i), label: String(i), requested: { amount, count: 1, missingAmountCount: 0 } }));
    expect(sortedRows(rows, "requested-desc").map((row) => row.key)).toEqual(["2", "0", "1"]);
  });
});
