// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { AnalyticsClient } from "@/app/analytics/analytics-client";
import { AnalyticsFiltersForm } from "@/app/analytics/analytics-filters";
import { AnalyticsPrint } from "@/app/analytics/print/print-client";
import { SummaryTable } from "@/app/analytics/report-summary";
import { analyticsFixture, analyticsClaimsFixture } from "./fixtures/analytics";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@mui/x-charts/BarChart", () => ({
  BarChart: ({ series }: { series: unknown }) => <div data-testid="chart" data-series={JSON.stringify(series)} />,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function choose(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}
function renderFilters(onApply = vi.fn()) {
  render(<AnalyticsFiltersForm filters={analyticsFixture.filters} departments={analyticsFixture.departmentOptions}
    pending={false} onApply={onApply} onReset={vi.fn()} />);
  return onApply;
}
function renderClient() {
  render(<AnalyticsClient report={analyticsFixture} claims={analyticsClaimsFixture} claimsError={null} view="month" sort="label" />);
}

describe("analytics filters and navigation", () => {
  it("selects a numeric month and converts the Buddhist year without a runtime error", async () => {
    const apply = renderFilters();
    await choose("ช่วงเวลา", "รายเดือน");
    await choose("เดือนรายงาน · เดือน", "กุมภาพันธ์");
    fireEvent.change(screen.getByRole("spinbutton", { name: "เดือนรายงาน · ปี พ.ศ." }), { target: { value: "2567" } });
    await userEvent.click(screen.getByRole("button", { name: "แสดงรายงาน" }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ interval: "month", fromMonth: "2024-02", toMonth: "2024-02", period: 1 }));
  });

  it("uses the fiscal ending year for quarters and resets the period when switching intervals", async () => {
    const apply = renderFilters();
    await choose("ช่วงเวลา", "ไตรมาส");
    await choose("ปฏิทิน", "ปีงบประมาณ · ต.ค.–ก.ย.");
    fireEvent.change(screen.getByRole("spinbutton", { name: "ปีงบประมาณ พ.ศ." }), { target: { value: "2570" } });
    await userEvent.click(screen.getByRole("button", { name: "แสดงรายงาน" }));
    expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ fromMonth: "2026-10", toMonth: "2026-12", year: 2027 }));
    await choose("รอบรายงาน", "ไตรมาส 4 · ก.ค.–ก.ย.");
    await choose("ช่วงเวลา", "รายปี");
    await userEvent.click(screen.getByRole("button", { name: "แสดงรายงาน" }));
    expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ period: 1, fromMonth: "2026-10", toMonth: "2027-09" }));
  });

  it("keeps an invalid range visible and offers an inline correction instead of navigating", async () => {
    const apply = renderFilters();
    await choose("ช่วงเวลา", "ช่วงเดือน");
    fireEvent.change(screen.getByRole("spinbutton", { name: "เริ่มต้น · ปี พ.ศ." }), { target: { value: "2571" } });
    await userEvent.click(screen.getByRole("button", { name: "แสดงรายงาน" }));
    expect(screen.getByRole("alert").textContent).toContain("ตัวกรองไม่ถูกต้อง");
    expect(apply).not.toHaveBeenCalled();
    expect((screen.getByRole("spinbutton", { name: "เริ่มต้น · ปี พ.ศ." }) as HTMLInputElement).value).toBe("2571");
  });

  it("supports multiple departments and statuses", async () => {
    const apply = renderFilters();
    const department = screen.getByRole("combobox", { name: "แผนก" });
    await userEvent.click(department);
    await userEvent.click(await screen.findByRole("option", { name: "แผนกก่อสร้างและปฏิบัติการระบบไฟฟ้า" }));
    await userEvent.click(await screen.findByRole("option", { name: "แผนกบริการลูกค้าและบำรุงรักษา" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("combobox", { name: "สถานะเอกสาร" }));
    await userEvent.click(await screen.findByRole("option", { name: "อนุมัติแล้ว" }));
    await userEvent.click(await screen.findByRole("option", { name: "ฉบับร่าง" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "แสดงรายงาน" }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      departmentIds: analyticsFixture.departmentOptions.slice(0, 2).map((department) => department.id), statuses: ["APPROVED", "DRAFT"],
    }));
  });

  it("persists view and pagination to URL and keeps exports summary-only", async () => {
    renderClient();
    await userEvent.click(screen.getByRole("tab", { name: "แผนก" }));
    expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining("view=department"), { scroll: false });
    await userEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining("page=2"), { scroll: false });
    expect(screen.getByRole("link", { name: "CSV · รายเดือน" }).getAttribute("href")).toMatch(/^\/api\/analytics\/export\?/);
    expect(screen.getByRole("link", { name: /เปิดคำขอ ผู้ทดสอบ/ }).getAttribute("href")).toContain("claimId=fixture-personal-claim");
    expect(screen.getByRole("link", { name: "พิมพ์ / PDF" }).getAttribute("href")).not.toContain("claimId");
  });
});

describe("analytics report interpretation and printing", () => {
  it("shows distinct summary totals instead of summing claimants from rows and supports drilling", async () => {
    const drill = vi.fn();
    const { container } = render(<SummaryTable report={analyticsFixture} view="department" sort="label" onDrill={drill} />);
    const total = container.querySelector("tfoot tr")!;
    expect(total.querySelector("td:last-child")?.textContent).toBe("12");
    await userEvent.click(screen.getByRole("button", { name: "กรองแผนก แผนกก่อสร้างและปฏิบัติการระบบไฟฟ้า" }));
    expect(drill).toHaveBeenCalledWith("department", analyticsFixture.departments[0]);
  });

  it("explains missing amounts, offers accessible chart tables and preserves future recorded data", async () => {
    renderClient();
    expect(screen.getByText("คำนวณไม่ได้")).toBeTruthy();
    expect(screen.getByText(/โดยไม่ถือยอดที่ขาดเป็นศูนย์/)).toBeTruthy();
    const series = JSON.parse(screen.getAllByTestId("chart")[0].getAttribute("data-series")!);
    expect(series[0].data[9]).toBe(Number(analyticsFixture.months[9].requested.amount));
    expect(series[0].data[10]).toBe(null);
    await userEvent.click(screen.getByText("ดูข้อมูลกราฟสถานะเป็นตาราง"));
    expect(screen.getByRole("table", { name: "สถานะคำขอรายเดือน หน่วยเอกสาร" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "ยอดเงิน" }));
    expect(screen.getByRole("table", { name: "สถานะคำขอรายเดือน หน่วยบาท" })).toBeTruthy();
  });

  it("prints the same report summary without personal claim data and isolates paper styles", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const { container } = render(<AnalyticsPrint report={analyticsFixture} view="status" sort="label" />);
    expect(screen.queryByText("รายการที่คุณมีสิทธิ์ดู")).toBeNull();
    expect(container.textContent).not.toContain(analyticsClaimsFixture.items[0].claimantName);
    expect(container.innerHTML).not.toContain(analyticsClaimsFixture.items[0].id);
    expect(screen.getByRole("heading", { name: "สรุปสถานะ" })).toBeTruthy();
    expect(within(container.querySelector("tfoot")!).getByText("รวมตามตัวกรอง")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "พิมพ์ / บันทึก PDF" }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
    const css = readFileSync("app/analytics/analytics.css", "utf8");
    expect(css).toContain("@page analytics-report");
    expect(css).toContain("page: analytics-report");
    expect(css).toContain("display: table-header-group");
    expect(css).not.toMatch(/@page\s*\{/);
  });
});
