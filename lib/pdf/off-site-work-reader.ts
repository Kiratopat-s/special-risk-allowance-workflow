"use client";

import { error, type Result } from "@/lib/shared/types/result";
import { extractOffSiteWorkDraft, type OffSiteWorkPdfDraft, type PdfTextPage } from "./off-site-work-parser";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;

export async function parseOffSiteWorkPdf(file: File, signal?: AbortSignal): Promise<Result<OffSiteWorkPdfDraft>> {
  if (!file.size || file.size > MAX_PDF_BYTES) return error("กรุณาเลือก PDF ขนาดไม่เกิน 10 MB", "PDF_SIZE");
  if (!file.name.toLowerCase().endsWith(".pdf")) return error("กรุณาเลือกไฟล์ PDF", "PDF_TYPE");
  let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
  const abort = () => { void task?.destroy().catch(() => {}); };
  try {
    signal?.throwIfAborted();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return error("ไฟล์นี้ไม่ใช่ PDF ที่ถูกต้อง", "PDF_TYPE");
    const pdfjs = await import("pdfjs-dist");
    signal?.throwIfAborted();
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker-${pdfjs.version}.min.mjs`;
    task = pdfjs.getDocument({ data: bytes, useSystemFonts: false });
    signal?.addEventListener("abort", abort, { once: true });
    task.onPassword = () => { abort(); };
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) return error("รองรับ PDF ไม่เกิน 20 หน้า", "PDF_PAGE_LIMIT");
    const pages: PdfTextPage[] = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      signal?.throwIfAborted();
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      pages.push({ items: content.items.filter((item) => "str" in item) });
      page.cleanup();
    }
    signal?.throwIfAborted();
    return extractOffSiteWorkDraft(pages);
  } catch {
    return error(signal?.aborted ? "ยกเลิกการอ่านไฟล์แล้ว" : "อ่าน PDF ไม่สำเร็จ ไฟล์อาจเสียหายหรือติดรหัสผ่าน กรุณาเลือกไฟล์ใหม่หรือกรอกเอง", signal?.aborted ? "PDF_CANCELLED" : "PDF_READ_ERROR");
  } finally {
    signal?.removeEventListener("abort", abort);
    await task?.destroy().catch(() => {});
  }
}
