"use client";

import { useEffect, useRef, useState } from "react";
import type { ClaimPrintDocument } from "@/lib/shared/types/claim-print";
import { paginateMeasuredClaim, type ClaimPrintPage } from "@/lib/ui/claim-print-pagination";
import { ClaimPrintSheet } from "./claim-print-sheet";
import "./claim-print.css";

type PageGroup = { document: ClaimPrintDocument; pages: ClaimPrintPage[] };

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("โหลดฟอนต์หรือภาพไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่")), 20000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function waitForPrintResources(root: HTMLElement): Promise<void> {
  await withTimeout((async () => {
    const fonts = await Promise.all([
      document.fonts.load("14pt ClaimSarabun", "ภาษาไทย"),
      document.fonts.load("700 14pt ClaimSarabun", "ภาษาไทย"),
    ]);
    if (fonts.some((faces) => !faces.length)) throw new Error("ไม่สามารถโหลดฟอนต์ TH Sarabun ได้");
    await document.fonts.ready;
    await Promise.all(Array.from(root.querySelectorAll("img")).map(async (img) => {
      await img.decode();
      if (!img.naturalWidth) throw new Error("ไม่สามารถโหลดโลโก้หรือลายเซ็นได้");
    }));
  })());
}

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export function ClaimPrintPreview({ documents, title }: { documents: ClaimPrintDocument[]; title: string }) {
  const measurementRef = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<PageGroup[] | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!documents.length) return;
    let cancelled = false;
    const prepare = async () => {
      const root = measurementRef.current;
      if (!root) return;
      await waitForPrintResources(root);
      await nextPaint();
      if (cancelled) return;
      const height = (selector: string, scope: ParentNode = root) => {
        const node = scope.querySelector<HTMLElement>(selector);
        if (!node) throw new Error("แบบฟอร์มไม่พร้อม กรุณาลองใหม่");
        return node.getBoundingClientRect().height;
      };
      const sheets = Array.from(root.querySelectorAll<HTMLElement>(".claim-print-sheet"));
      const result = documents.map((doc, index) => {
        const sheet = sheets[index];
        const probe = sheet.querySelector<HTMLElement>("[data-note-text]")!;
        const measure = probe.cloneNode(false) as HTMLElement;
        probe.parentElement!.appendChild(measure);
        try {
          const pages = paginateMeasuredClaim(doc.notes, {
            capacity: height(".claim-print-paper-height") - height("[data-sheet-heading]", sheet) -
              height("[data-orders-heading]", sheet) - height("[data-sheet-footer]", sheet) - 3,
            rowHeights: Array.from(sheet.querySelectorAll("[data-order-row]")).map((row) => row.getBoundingClientRect().height),
            blankRowHeight: height(".claim-print-row-height"),
            lineHeight: height(".claim-print-line-height"),
            noteOverhead: height(".claim-print-note-overhead"),
            measureNote: (text) => {
              measure.textContent = text;
              return measure.getBoundingClientRect().height;
            },
          });
          return { document: doc, pages };
        } finally { measure.remove(); }
      });
      if (!cancelled) setGroups(result);
    };
    void prepare().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "เตรียมเอกสารไม่สำเร็จ กรุณาลองใหม่");
    });
    return () => { cancelled = true; };
  }, [documents, attempt]);

  useEffect(() => {
    if (!groups) return;
    let cancelled = false;
    const verify = async () => {
      const root = sheetsRef.current;
      if (!root) return;
      await waitForPrintResources(root);
      await nextPaint();
      if (cancelled) return;
      for (const sheet of root.querySelectorAll<HTMLElement>(".claim-print-sheet")) {
        const footer = sheet.querySelector<HTMLElement>("[data-sheet-footer]")!;
        const content = sheet.querySelector<HTMLElement>("[data-sheet-content]")!;
        if (content.getBoundingClientRect().bottom > footer.getBoundingClientRect().top + 1 ||
          footer.getBoundingClientRect().bottom > sheet.getBoundingClientRect().bottom + 1 ||
          sheet.scrollWidth > sheet.clientWidth + 1) {
          throw new Error("เนื้อหาเกินพื้นที่กระดาษ กรุณาตรวจสอบข้อความที่ยาวหรือลองเตรียมเอกสารใหม่");
        }
      }
      setReady(true);
    };
    void verify().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "ตรวจสอบหน้าพิมพ์ไม่สำเร็จ");
    });
    return () => { cancelled = true; };
  }, [groups]);

  const totalPages = groups?.reduce((total, group) => total + group.pages.length, 0) ?? 0;
  const retry = () => { setReady(false); setError(null); setGroups(null); setAttempt((value) => value + 1); };
  return (
    <div className="claim-print-preview" data-ready={ready}>
      <div className="claim-print-toolbar">
        <h1>{title}</h1>
        {documents.length ? <>
          <div className="claim-print-actions">
            <button type="button" disabled={!ready || !!error} onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
            <span>{documents.length} คำขอ · {totalPages ? `${totalPages} หน้า` : "กำลังแบ่งหน้า"}</span>
          </div>
          <p>เลือกกระดาษ A4 แนวนอน ขนาด 100% และปิดหัวกระดาษ/ท้ายกระดาษของเบราว์เซอร์ เลือก Save as PDF เพื่อบันทึกไฟล์</p>
          {!ready && !error ? <p role="status">กำลังโหลดฟอนต์ ภาพ และจัดหน้ากระดาษ…</p> : null}
          {error ? <div role="alert" className="claim-print-error"><p>{error}</p><div className="claim-print-actions"><button type="button" onClick={retry}>ลองใหม่</button></div></div> : null}
          {documents.some((doc) => doc.warnings.length) && <details className="claim-print-warning" open>
            <summary>ข้อมูลที่ควรตรวจสอบก่อนพิมพ์ ({documents.filter((doc) => doc.warnings.length).length} คำขอ)</summary>
            {documents.filter((doc) => doc.warnings.length).map((doc) => <div key={doc.id}><p><strong>{doc.employeeId} {doc.claimantName}</strong> · {doc.id}</p><ul>{doc.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>)}
          </details>}
        </> : <p role="status">ไม่มีคำขอเบิกที่สามารถพิมพ์ได้ในชุดนี้</p>}
      </div>
      <div className="claim-print-guard">เอกสารยังไม่พร้อมพิมพ์ กรุณากลับไปหน้า Preview และรอให้ปุ่มพิมพ์พร้อมใช้งาน</div>
      <div className="claim-print-scroll" ref={sheetsRef}>
        {groups?.map((group) => group.pages.map((page, index) => <ClaimPrintSheet key={`${group.document.id}-${index}`} document={group.document} page={page} pageNumber={index + 1} totalPages={group.pages.length} />))}
      </div>
      <div className="claim-print-measurement" ref={measurementRef} aria-hidden="true">
        <div className="claim-print-paper-height" /><div className="claim-print-row-height" /><div className="claim-print-line-height" /><div className="claim-print-note-overhead" />
        {documents.map((doc) => <ClaimPrintSheet key={doc.id} document={doc} page={{ rowIndices: doc.orders.map((_, i) => i), blankRows: 0, noteText: "", blankNoteLines: 0 }} pageNumber={1} totalPages={1} measurement />)}
      </div>
    </div>
  );
}
