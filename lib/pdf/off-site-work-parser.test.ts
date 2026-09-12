import { describe, expect, it } from "vitest";
import { cleanPdfText, extractOffSiteWorkDraft, parseThaiDate, type PdfTextItem, type PdfTextPage } from "./off-site-work-parser";

function line(text: string, y: number, x = 30, width = text.length * 4): PdfTextItem {
  return { str: text, transform: [1, 0, 0, 1, x, y], width, height: 10, hasEOL: true };
}
function row(code: string, name: string, y: number): PdfTextItem[] {
  return [line(code, y, 65, 35), line(name, y, 160, 130), line("พชง.5", y, 370, 30), line("ฝ่ายทดสอบ", y, 470, 60)]
    .map((item, index) => ({ ...item, hasEOL: index === 3 }));
}
function fixture(): PdfTextPage[] {
  return [{ items: [
    line("คำขออนุมัติเดินทางไปปฏิบัติงานต่างพื้นที่ TZ26010001", 800),
    line("เลขที\0หนังสืออ้างอิง", 760), line("ไม่มี กท. 10/2569 ปฏิบัติงานต่อเนื\0อง ใช่ ไม่ใช่", 740),
    line("วันที\0เริ\0มต้น", 700), line("17 กันยายน 2569", 680),
    line("วันที\0สิ\0นสุด", 700, 320), line("2 ตุลาคม 2569", 680, 320),
    line("วัตถุประสงค์", 640), line("เป\0นวิทยากร", 620), line("อบรมภาคปฏิบัติ", 605),
    line("สถานที\0ปฏิบัติงาน", 580), line("ศูนย์ฝึก", 560),
    line("ประเภทยานพาหนะ", 540), line("รถยนต์", 520),
    line("รายชื\0อผู้เดินทาง", 480), line("เลขประจำตัวพนักงาน ชื่อ-นามสกุล ตำแหน่ง สังกัด", 460),
    ...row("100001", "สมชาย ตัวอย่าง", 440),
  ] }, { items: [line("คำขออนุมัติเดินทางไปปฏิบัติงานต่างพื้นที่ TZ26010001", 800),
    line("ขอรับรองว่าพิมพ์จากระบบจริง", 780),
    line("เลขประจำตัวพนักงาน ชื่อ-นามสกุล ตำแหน่ง สังกัด", 740),
    ...row("100002", "สมหญิง ทดสอบ", 720),
    line("หมายเหตุ", 680), line("ประวัติ", 650), ...row("999999", "ผู้อนุมัติ ตัวอย่าง", 620),
  ] }];
}

describe("off-site work PDF extraction", () => {
  it("maps fields and table continuation by layout, ignoring controls and approval history", () => {
    const result = extractOffSiteWorkDraft(fixture());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.fields).toEqual({ id: "TZ26010001", innerRefDocumentId: "กท. 10/2569", startDate: "2026-09-17", endDate: "2026-10-02", objective: "เป�นวิทยากร อบรมภาคปฏิบัติ", location: "ศูนย์ฝึก" });
    expect(result.data.employees.map((employee) => employee.employeeId)).toEqual(["100001", "100002"]);
    expect(result.data.employees[0]).toMatchObject({ userId: null, firstName: "สมชาย", lastName: "ตัวอย่าง", position: "พชง.5", departmentName: "ฝ่ายทดสอบ" });
    expect(result.data.issues).toEqual([expect.objectContaining({ field: "objective" })]);
  });
  it("leaves missing required values blank and reports malformed traveler rows", () => {
    const pages = fixture();
    pages[0].items = pages[0].items.filter((item) => item.str !== "17 กันยายน 2569");
    pages[0].items.find((item) => item.str === "100001")!.str = "10000�";
    const result = extractOffSiteWorkDraft(pages);
    if (!result.success) throw Error(result.error);
    expect(result.data.fields.startDate).toBe("");
    expect(result.data.issues.some((issue) => issue.message.includes("10000�"))).toBe(true);
  });
  it("rejects mixed documents, scans, and unrelated text", () => {
    const pages = fixture();
    pages[1].items[0].str = pages[1].items[0].str.replace("TZ26010001", "TZ26010002");
    expect(extractOffSiteWorkDraft(pages)).toMatchObject({ success: false, code: "PDF_MULTIPLE_DOCUMENTS" });
    expect(extractOffSiteWorkDraft([{ items: [] }])).toMatchObject({ success: false, code: "PDF_NO_TEXT" });
    expect(extractOffSiteWorkDraft([{ items: [line("บันทึกอื่น", 800)] }])).toMatchObject({ success: false, code: "PDF_UNSUPPORTED" });
  });
  it("deduplicates repeated rows and reports them", () => {
    const pages = fixture();
    pages[1].items.find((item) => item.str === "100002")!.str = "100001";
    const result = extractOffSiteWorkDraft(pages);
    if (!result.success) throw Error(result.error);
    expect(result.data.employees).toHaveLength(1);
    expect(result.data.issues.some((issue) => issue.message.includes("ซ้ำ"))).toBe(true);
  });
  it.each([["๒๙ กุมภาพันธ์ ๒๕๖๗", "2024-02-29"], ["29 กุมภาพันธ์ 2569", ""], ["31 กันยายน 2569", ""], ["2 ต�ลาคม 2569", ""]])("parses calendar date %s", (text, expected) => {
    expect(parseThaiDate(text)).toBe(expected);
  });
  it("retains lost-glyph markers while normalizing Sara Am", () => {
    expect(cleanPdfText("คํา\0\nทดสอบ")).toBe("คำ� ทดสอบ");
  });
});
