// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PdfImport } from "@/app/off-site-work/pdf-import";
import type { OffSiteWorkPdfDraft } from "@/lib/pdf/off-site-work-parser";

const mock = vi.hoisted(() => ({ parse: vi.fn(), match: vi.fn() }));
vi.mock("@/lib/pdf/off-site-work-reader", () => ({ parseOffSiteWorkPdf: mock.parse }));
vi.mock("@/app/actions/off-site-work", () => ({ matchOffSiteWorkEmployees: mock.match }));
const fields = { id: "TZ26010001", startDate: "2026-09-17", endDate: "2026-10-02", objective: "ทดสอบ", location: "ศูนย์ฝึก", innerRefDocumentId: "กท. 10/2569" };
const draft: OffSiteWorkPdfDraft = { fields, employees: [{ userId: null, employeeId: "100001", firstName: "ทดสอบ", lastName: "รายชื่อ", position: null, departmentId: null, departmentName: null }], issues: [] };
const pendingTravelers = [{ userId: null, employeeId: "100001", firstName: "", lastName: "", position: null, departmentId: null, departmentName: null }];
function upload(name = "order.pdf") {
  fireEvent.change(screen.getByLabelText("เลือกไฟล์ PDF"), { target: { files: [new File(["%PDF-test"], name, { type: "application/pdf" })] } });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.parse.mockResolvedValue({ success: true, data: draft });
  mock.match.mockResolvedValue({ success: true, data: [] });
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("PDF import review", () => {
  it("only applies after review, protects manual values, and retains unmatched travelers", async () => {
    const apply = vi.fn();
    const pending = vi.fn();
    render(<PdfImport protectedFields={["location"]} currentFields={{ ...fields, location: "กรอกเอง" }} onApply={apply} onPendingChange={pending} />);
    upload();
    await screen.findByText("ตรวจทานข้อมูลก่อนนำลงฟอร์ม");
    expect(screen.getAllByText("17 ก.ย. 2569").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 ต.ค. 2569").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TZ26010001").length).toBeGreaterThan(0);
    expect(apply).not.toHaveBeenCalled();
    expect(pending).toHaveBeenLastCalledWith(true);
    expect(mock.match).toHaveBeenCalledWith(["100001"]);
    fireEvent.click(screen.getByRole("button", { name: "นำข้อมูลลงฟอร์ม" }));
    const { location: _location, ...expected } = fields;
    void _location;
    expect(apply).toHaveBeenCalledWith(expected, pendingTravelers);
    expect(pending).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText("ตรวจทานข้อมูลก่อนนำลงฟอร์ม")).toBeNull();
  });
  it("accounts for edits made while extraction is still running and allows explicit overwrite", async () => {
    let finish!: (value: unknown) => void;
    mock.parse.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const apply = vi.fn();
    const view = render(<PdfImport protectedFields={[]} currentFields={fields} onApply={apply} />);
    upload();
    view.rerender(<PdfImport protectedFields={["objective"]} currentFields={{ ...fields, objective: "เขียนเอง" }} onApply={apply} />);
    await act(async () => finish({ success: true, data: draft }));
    const checkbox = screen.getByRole("checkbox", { name: /วัตถุประสงค์/ }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "นำข้อมูลลงฟอร์ม" }));
    expect(apply).toHaveBeenCalledWith(fields, pendingTravelers);
  });
  it("ignores stale results when replacing a file and releases local preview URLs", async () => {
    let finish!: (value: unknown) => void;
    mock.parse.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<PdfImport protectedFields={[]} currentFields={fields} onApply={vi.fn()} />);
    upload("old.pdf");
    const oldSignal = mock.parse.mock.calls[0][1] as AbortSignal;
    upload("new.pdf");
    await screen.findByRole("link", { name: "ดูต้นฉบับ: new.pdf" });
    await act(async () => finish({ success: true, data: { ...draft, fields: { ...fields, id: "STALE" } } }));
    expect(oldSignal.aborted).toBe(true);
    expect(screen.queryByText("STALE")).toBeNull();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
  it("cancels an in-flight read without applying it", async () => {
    let finish!: (value: unknown) => void;
    mock.parse.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const apply = vi.fn();
    render(<PdfImport protectedFields={[]} currentFields={fields} onApply={apply} />);
    upload();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิกการอ่าน" }));
    await act(async () => finish({ success: true, data: draft }));
    expect(screen.queryByText("ตรวจทานข้อมูลก่อนนำลงฟอร์ม")).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
  it("keeps missing required values blank and uses account data on an exact match", async () => {
    mock.parse.mockResolvedValue({ success: true, data: { ...draft, fields: { ...fields, id: "", startDate: "" } } });
    const matched = { ...draft.employees[0], userId: "user-1", firstName: "ชื่อจากระบบ" };
    mock.match.mockResolvedValue({ success: true, data: [matched] });
    const apply = vi.fn();
    render(<PdfImport protectedFields={[]} currentFields={fields} onApply={apply} />);
    upload();
    await screen.findByText("ตรวจทานข้อมูลก่อนนำลงฟอร์ม");
    fireEvent.click(screen.getByRole("button", { name: "นำข้อมูลลงฟอร์ม" }));
    expect(apply).toHaveBeenCalledWith({ ...fields, id: "", startDate: "" }, [matched]);
  });
  it("reports reader failures without altering the form", async () => {
    mock.parse.mockResolvedValue({ success: false, error: "PDF ไม่รองรับ" });
    const apply = vi.fn();
    render(<PdfImport protectedFields={[]} currentFields={fields} onApply={apply} />);
    upload();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("PDF ไม่รองรับ"));
    expect(apply).not.toHaveBeenCalled();
    expect(mock.match).not.toHaveBeenCalled();
  });
});
