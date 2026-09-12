// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ document: vi.fn(), worker: { workerSrc: "" } }));
vi.mock("pdfjs-dist", () => ({ getDocument: mock.document, GlobalWorkerOptions: mock.worker, version: "6.2.108" }));
import { MAX_PDF_BYTES, parseOffSiteWorkPdf } from "./off-site-work-reader";

function file(text = "%PDF-fixture", name = "fixture.pdf", size?: number) {
  const input = new File([text], name, { type: "application/pdf" });
  Object.defineProperty(input, "arrayBuffer", { value: async () => new TextEncoder().encode(text).buffer });
  if (size != null) Object.defineProperty(input, "size", { value: size });
  return input;
}
beforeEach(() => { vi.resetAllMocks(); });
describe("local PDF reader", () => {
  it("rejects size, extension and invalid PDF signatures without starting a worker", async () => {
    expect(await parseOffSiteWorkPdf(file("", "empty.pdf"))).toMatchObject({ success: false, code: "PDF_SIZE" });
    expect(await parseOffSiteWorkPdf(file("%PDF-", "huge.pdf", MAX_PDF_BYTES + 1))).toMatchObject({ success: false, code: "PDF_SIZE" });
    expect(await parseOffSiteWorkPdf(file("%PDF-", "wrong.txt"))).toMatchObject({ success: false, code: "PDF_TYPE" });
    expect(await parseOffSiteWorkPdf(file("not pdf"))).toMatchObject({ success: false, code: "PDF_TYPE" });
    expect(mock.document).not.toHaveBeenCalled();
  });
  it("enforces page count and destroys resources", async () => {
    const destroy = vi.fn(async () => {});
    mock.document.mockReturnValue({ promise: Promise.resolve({ numPages: 21 }), destroy });
    expect(await parseOffSiteWorkPdf(file())).toMatchObject({ success: false, code: "PDF_PAGE_LIMIT" });
    expect(destroy).toHaveBeenCalled();
    expect(mock.worker.workerSrc).toBe("/pdfjs/pdf.worker-6.2.108.min.mjs");
    expect(mock.document).toHaveBeenCalledWith({ data: expect.any(Uint8Array), useSystemFonts: false });
  });
  it("handles scans, damaged and password-protected PDFs without prompting", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn(async () => {});
    mock.document.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [] }), cleanup }) }), destroy });
    expect(await parseOffSiteWorkPdf(file())).toMatchObject({ success: false, code: "PDF_NO_TEXT" });
    expect(cleanup).toHaveBeenCalled();
    mock.document.mockImplementation(() => ({ promise: Promise.reject(Error("PasswordException")), destroy }));
    expect(await parseOffSiteWorkPdf(file())).toMatchObject({ success: false, code: "PDF_READ_ERROR" });
    expect(destroy).toHaveBeenCalledTimes(2);
  });
  it("does not read cancelled requests", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await parseOffSiteWorkPdf(file(), controller.signal)).toMatchObject({ success: false, code: "PDF_CANCELLED" });
    expect(mock.document).not.toHaveBeenCalled();
  });
});
