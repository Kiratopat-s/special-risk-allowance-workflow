// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClaimPrintPreview } from "@/components/claim-print/claim-print-preview";
import { printDocument } from "./fixtures/claim-print";

const decode = vi.fn();
const print = vi.fn();
beforeEach(() => {
  decode.mockReset().mockResolvedValue(undefined);
  print.mockReset();
  vi.stubGlobal("print", print);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: vi.fn(async () => [{}]), ready: Promise.resolve() } });
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
  Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: decode });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const height = this.matches(".claim-print-sheet,.claim-print-paper-height") ? 718 :
      this.matches("[data-sheet-heading]") ? 300 :
      this.matches("[data-sheet-footer]") ? 28 :
      this.matches("[data-order-row],.claim-print-row-height") ? 42 :
      this.matches("[data-orders-heading],.claim-print-note-overhead") ? 34 : 23;
    const top = this.matches("[data-sheet-footer]") ? 690 : 0;
    return { x: 0, y: top, top, left: 0, right: 1062, bottom: top + height, width: 1062, height, toJSON: () => ({}) };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("previews first, waits for assets and only prints on an explicit click", async () => {
  let release!: () => void;
  decode.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
  render(<ClaimPrintPreview documents={[printDocument()]} title="ตัวอย่างคำขอ" />);
  const button = screen.getByRole("button", { name: "พิมพ์ / บันทึก PDF" });
  expect(button.hasAttribute("disabled")).toBe(true);
  await waitFor(() => expect(decode).toHaveBeenCalled());
  expect(print).not.toHaveBeenCalled();
  decode.mockResolvedValue(undefined);
  release();
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  expect(print).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByText("1 คำขอ · 1 หน้า")).toBeTruthy();
  expect(document.querySelectorAll(".claim-print-scroll .claim-print-sheet")).toHaveLength(1);
});

it("shows a retryable resource error rather than printing a missing image", async () => {
  decode.mockRejectedValue(new Error("ภาพลายเซ็นโหลดไม่สำเร็จ"));
  render(<ClaimPrintPreview documents={[printDocument()]} title="ตัวอย่างคำขอ" />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "พิมพ์ / บันทึก PDF" }).hasAttribute("disabled")).toBe(true);
  decode.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "พิมพ์ / บันทึก PDF" }).hasAttribute("disabled")).toBe(false));
  expect(print).not.toHaveBeenCalled();
});

it("renders empty collections without a print button", () => {
  render(<ClaimPrintPreview documents={[]} title="ชุดว่าง" />);
  expect(screen.queryByRole("button", { name: "พิมพ์ / บันทึก PDF" })).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("ไม่มีคำขอ");
});

it("does not print with a fallback font when the Thai font fails to load", async () => {
  vi.mocked(document.fonts.load).mockResolvedValue([]);
  render(<ClaimPrintPreview documents={[printDocument()]} title="ฟอนต์ไม่พร้อม" />);
  expect((await screen.findByRole("alert")).textContent).toContain("TH Sarabun");
  expect(screen.getByRole("button", { name: "พิมพ์ / บันทึก PDF" }).hasAttribute("disabled")).toBe(true);
  expect(print).not.toHaveBeenCalled();
});

it("blocks printing if measured content overlaps the footer", async () => {
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.mocked(original).mockImplementation(function (this: HTMLElement) {
    const top = this.matches("[data-sheet-footer]") ? 690 : 0;
    const height = this.matches(".claim-print-sheet,.claim-print-paper-height") ? 718 :
      this.matches("[data-sheet-content]") ? 710 :
      this.matches("[data-sheet-heading]") ? 300 :
      this.matches("[data-sheet-footer]") ? 28 :
      this.matches("[data-order-row],.claim-print-row-height") ? 42 : 23;
    return { x: 0, y: top, top, left: 0, right: 1062, bottom: top + height, width: 1062, height, toJSON: () => ({}) };
  });
  render(<ClaimPrintPreview documents={[printDocument()]} title="เนื้อหาล้น" />);
  expect((await screen.findByRole("alert")).textContent).toContain("เนื้อหาเกินพื้นที่กระดาษ");
  expect(screen.getByRole("button", { name: "พิมพ์ / บันทึก PDF" }).hasAttribute("disabled")).toBe(true);
});

it("starts each claim on its own sheet and labels the pending status", async () => {
  render(<ClaimPrintPreview documents={[printDocument(), printDocument({ id: "claim-2", employeeId: "000002", approved: true, status: "อนุมัติแล้ว" })]} title="ทั้งชุด" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "พิมพ์ / บันทึก PDF" }).hasAttribute("disabled")).toBe(false));
  const sheets = document.querySelectorAll(".claim-print-scroll .claim-print-sheet");
  expect(sheets).toHaveLength(2);
  expect(sheets[0].textContent).toContain("ยังไม่อนุมัติ");
  expect(sheets[1].textContent).not.toContain("ยังไม่อนุมัติ");
});
