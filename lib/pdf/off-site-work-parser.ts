import type { EmployeeListItem } from "@/lib/domains/off-site-work/types";
import { error, success, type Result } from "@/lib/shared/types/result";

export const PDF_FIELDS = {
  id: "เลขที่เอกสาร",
  innerRefDocumentId: "เลขอ้างอิงภายใน",
  startDate: "วันเริ่มต้น",
  endDate: "วันสิ้นสุด",
  objective: "วัตถุประสงค์",
  location: "สถานที่",
} as const;
export type PdfField = keyof typeof PDF_FIELDS;
export interface OffSiteWorkPdfDraft {
  fields: Record<PdfField, string>;
  employees: EmployeeListItem[];
  issues: { field: PdfField | "employees"; message: string }[];
}
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
}
export interface PdfTextPage { items: PdfTextItem[] }
interface Line { text: string; items: PdfTextItem[]; x: number; y: number }

// Keep lost glyphs visible. Removing them silently changes Thai words and names.
export function cleanPdfText(text: string): string {
  return text.replace(/\u0000/g, "\uFFFD").replace(/\u0e4d\u0e32/g, "\u0e33")
    .replace(/[\t\r\n ]+/g, " ").trim().normalize("NFC");
}
// Only labels may be compared without diacritics; never repair free text by guessing.
function labelKey(text: string): string {
  return cleanPdfText(text).replace(/[\s\uFFFD\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/g, "");
}
function matches(text: string, label: string): boolean {
  return labelKey(text).includes(labelKey(label));
}
function linesFromPage(page: PdfTextPage): Line[] {
  const lines: Line[] = [];
  let items: PdfTextItem[] = [];
  function flush() {
    const visible = items.filter((item) => item.str.trim());
    if (visible.length) {
      const ys = visible.map((item) => item.transform[5]).sort((a, b) => a - b);
      lines.push({ text: cleanPdfText(items.map((item) => item.str).join("")), items,
        x: Math.min(...visible.map((item) => item.transform[4])), y: ys[Math.floor(ys.length / 2)] });
    }
    items = [];
  }
  for (const item of page.items) {
    items.push(item);
    if (item.hasEOL) flush();
  }
  flush();
  return lines.sort((a, b) => Math.abs(a.y - b.y) < 3 ? a.x - b.x : b.y - a.y);
}

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export function parseThaiDate(text: string): string {
  const value = cleanPdfText(text).replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
  const match = value.match(/^(\d{1,2})\s+([^\d]+?)\s+(\d{4})$/);
  if (!match) return "";
  const month = MONTHS.indexOf(match[2]) + 1;
  const year = Number(match[3]) - 543;
  const day = Number(match[1]);
  if (!month || year < 1900 || year > 2200) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
}

const HEADINGS = ["เลขที่หนังสืออ้างอิง", "วันที่เริ่มต้น", "วันที่สิ้นสุด", "วัตถุประสงค์",
  "สถานที่ปฏิบัติงาน", "ประเภทยานพาหนะ", "รายชื่อผู้เดินทาง", "หมายเหตุ", "ประวัติ"];
function section(lines: Line[], heading: string): Line[] {
  const start = lines.find((line) => matches(line.text, heading));
  if (!start) return [];
  const below = lines.filter((line) => line.y < start.y - 3);
  const end = below.find((line) => HEADINGS.some((label) => matches(line.text, label)));
  return below.filter((line) => !end || line.y > end.y + 3);
}
function dateBelow(lines: Line[], heading: string): string {
  const start = lines.find((line) => matches(line.text, heading));
  if (!start) return "";
  return section(lines, heading).filter((line) => Math.abs(line.x - start.x) < 35)
    .map((line) => parseThaiDate(line.text)).find(Boolean) || "";
}
function columns(line: Line): string[] {
  const cells: PdfTextItem[][] = [];
  let end = -Infinity;
  for (const item of [...line.items].filter((item) => item.str.trim()).sort((a, b) => a.transform[4] - b.transform[4])) {
    const x = item.transform[4];
    if (x - end > 12) cells.push([]);
    cells[cells.length - 1].push(item);
    end = Math.max(end, x + item.width);
  }
  return cells.map((cell) => {
    let text = "";
    let right = cell[0].transform[4];
    for (const item of cell) {
      if (item.transform[4] - right > 1.5) text += " ";
      text += item.str;
      right = item.transform[4] + item.width;
    }
    return cleanPdfText(text);
  });
}

export function extractOffSiteWorkDraft(pages: PdfTextPage[]): Result<OffSiteWorkPdfDraft> {
  const allPages = pages.map(linesFromPage);
  const lines = allPages[0] || [];
  if (!allPages.some((page) => page.length)) return error("ไฟล์นี้ไม่มีข้อความให้อ่าน กรุณาใช้ PDF จากระบบเดิมหรือกรอกข้อมูลเอง", "PDF_NO_TEXT");
  if (!lines.some((line) => matches(line.text, "คำขออนุมัติเดินทางไปปฏิบัติงาน")) ||
      !lines.some((line) => matches(line.text, "รายชื่อผู้เดินทาง"))) {
    return error("ยังไม่รองรับรูปแบบเอกสารนี้ กรุณากรอกข้อมูลเอง", "PDF_UNSUPPORTED");
  }
  const ids = [...new Set(allPages.flatMap((page) => page.slice(0, 6).flatMap((line) => line.text.match(/\bTZ\d{8}\b/g) || [])))];
  if (ids.length > 1) return error("พบหลายเลขเอกสารในไฟล์เดียว กรุณาเลือก PDF หนึ่งคำสั่งต่อครั้ง", "PDF_MULTIPLE_DOCUMENTS");
  const ref = section(lines, "เลขที่หนังสืออ้างอิง").map((line) => line.text).join(" ")
    .replace(/^ไม่มี\s*/, "").replace(/ปฏิบัติงานต่อเน.*$/, "").trim();
  const draft: OffSiteWorkPdfDraft = {
    fields: {
      id: ids[0] || "", innerRefDocumentId: ref,
      startDate: dateBelow(lines, "วันที่เริ่มต้น"), endDate: dateBelow(lines, "วันที่สิ้นสุด"),
      objective: section(lines, "วัตถุประสงค์").map((line) => line.text).join(" "),
      location: section(lines, "สถานที่ปฏิบัติงาน").map((line) => line.text).join(" "),
    }, employees: [], issues: [],
  };
  const seen = new Set<string>();
  let inTable = false;
  for (const page of allPages) {
    for (const line of page) {
      if (matches(line.text, "รายชื่อผู้เดินทาง")) { inTable = true; continue; }
      if (inTable && (matches(line.text, "หมายเหตุ") || matches(line.text, "ประวัติ"))) { inTable = false; continue; }
      if (!inTable || matches(line.text, "เลขประจำตัวพนักงาน")) continue;
      if (!/[ก-๙A-Za-z0-9]/u.test(line.text)) continue;
      // Page headers and certification text must never become travelers.
      if (matches(line.text, "คำขออนุมัติ") || matches(line.text, "ขอรับรอง") ||
          matches(line.text, "ลงชื่อ") || matches(line.text, "ผู้บังคับบัญชา")) continue;
      const cells = columns(line);
      const employeeId = cells[0] || "";
      if (!/^\d{6}$/.test(employeeId)) {
        draft.issues.push({ field: "employees", message: `อ่านแถวผู้เดินทางไม่ครบ: ${line.text}` });
      }
      if (/^\d{6}$/.test(employeeId) && seen.has(employeeId)) {
        draft.issues.push({ field: "employees", message: `พบรหัส ${employeeId} ซ้ำ กรุณาตรวจสอบรายชื่อ` });
        continue;
      }
      if (/^\d{6}$/.test(employeeId)) seen.add(employeeId);
      const names = (cells[1] || "").split(/\s+/);
      draft.employees.push({ userId: null, employeeId, firstName: names[0] || "", lastName: names.slice(1).join(" "),
        position: cells[2] || null, departmentId: null, departmentName: cells[3] || null });
      if (cells.length !== 4 || names.length !== 2 || cells.some((cell) => cell.includes("\uFFFD"))) {
        draft.issues.push({ field: "employees", message: `ตรวจทานชื่อ ตำแหน่ง และสังกัดของรหัส ${employeeId}` });
      }
    }
  }
  for (const [field, label] of Object.entries(PDF_FIELDS) as [PdfField, string][]) {
    if (!draft.fields[field]) draft.issues.push({ field, message: `ไม่พบ${label}` });
    else if (draft.fields[field].includes("\uFFFD")) draft.issues.push({ field, message: `${label}มีอักษรที่อ่านไม่ครบ กรุณาแก้ไขเครื่องหมาย �` });
  }
  if (!draft.employees.length) draft.issues.push({ field: "employees", message: "ไม่พบรายชื่อผู้เดินทาง กรุณาเพิ่มรายชื่อเอง" });
  return success(draft);
}
