import type { ClaimPrintDocument } from "@/lib/shared/types/claim-print";

export function printDocument(overrides: Partial<ClaimPrintDocument> = {}): ClaimPrintDocument {
  return {
    id: "demo-claim-001",
    employeeId: "000001",
    claimantName: "นายทดสอบ ระบบเอกสาร",
    claimantPosition: "พชง.5 (ฮล)",
    month: "2026-07",
    monthName: "กรกฎาคม",
    buddhistYear: "2569",
    daysInMonth: 31,
    selectedDays: [1, 2, 21, 22, 23, 24, 27, 28, 29, 30, 31],
    countDates: "11",
    status: "ฉบับร่าง",
    approved: false,
    orders: [
      { id: "TZ26000001", location: "กฟส.พื้นที่ทดสอบ\nและภายในเขต กฟก.1", period: "26 มิ.ย. 2569 - 3 ก.ค. 2569", leaderName: "นายผู้ควบคุม งานทดสอบ", leaderPosition: "พชง.7 (ฮล)", leaderDepartment: "ผอฮ.กฝช.ฝพบ.", signatureUrl: null },
      { id: "TZ26000002", location: "กฟส.พื้นที่ตัวอย่าง\nและภายในเขต กฟต.1", period: "20 ก.ค. 2569 - 7 ส.ค. 2569", leaderName: "นายหัวหน้า งานตัวอย่าง", leaderPosition: "พชง.5 (ฮล)", leaderDepartment: "ผอฮ.กฝช.ฝพบ.", signatureUrl: null },
    ],
    notes: ["เอกสารตัวอย่างสำหรับทดสอบระบบ ไม่ใช่คำขอเบิกจริง", "เลขอ้างอิงภายใน: DEMO-001"],
    warnings: ["TZ26000002: ผู้ควบคุมยังไม่ได้รับรอง"],
    ...overrides,
  };
}
