import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildMrcSummaryXlsx } from "./export";
import { longDateDisplay, monthDisplay } from "@/lib/shared/format";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { MrcSummaryPrintData } from "./types";

const dec = (value: string) =>
  ({ toString: () => value }) as unknown as Prisma.Decimal;

const NOW = new Date("2026-09-15T03:00:00Z");
const REVIEWED_AT = new Date("2026-09-10T05:30:00Z");

function claim(overrides: {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  position: string;
  department: { shortName: string | null } | null;
  countDates: string;
  amount: string;
}) {
  return {
    id: overrides.id,
    expenseMonth: new Date("2026-09-01"),
    userId: `user-${overrides.id}`,
    claimantPositionAtSubmission: overrides.position,
    countDates: dec(overrides.countDates),
    amount: dec(overrides.amount),
    remark: null,
    status: "APPROVED" as const,
    claimant: {
      id: `claimant-${overrides.id}`,
      firstName: overrides.firstName,
      lastName: overrides.lastName,
      employeeId: overrides.employeeId,
      position: overrides.position,
      positionShort: null,
      positionLevel: null,
      departmentId: overrides.department ? "dep-1" : null,
      department: overrides.department,
    },
  };
}

function fixture(
  overrides: Partial<{
    expenseClaims: MrcSummaryPrintData["expenseClaims"];
    approvalSteps: MrcSummaryPrintData["approvalSteps"];
  }> = {},
): MrcSummaryPrintData {
  return {
    id: "mrc-1",
    collectorId: "collector-1",
    collectForMonth: new Date("2026-09-01"),
    countDates: dec("3.5"),
    amount: dec("4000.5"),
    status: "APPROVED",
    createdAt: new Date("2026-09-02"),
    updatedAt: null,
    cancelledAt: null,
    collector: {
      id: "collector-1",
      firstName: "ผู้",
      lastName: "รวบรวม",
      employeeId: "000009",
    },
    expenseClaims: overrides.expenseClaims ?? [
      claim({
        id: "c3",
        employeeId: "000003",
        firstName: "สมศรี",
        lastName: "รักดี",
        position: "พนักงานช่าง",
        department: { shortName: "กฟฟ.1" },
        countDates: "2.00",
        amount: "1500.00",
      }),
      claim({
        id: "c1",
        employeeId: "000001",
        firstName: "สมชาย",
        lastName: "ใจดี",
        position: "พนักงาน",
        department: { shortName: "กฟฟ.2" },
        countDates: "0",
        amount: "0",
      }),
      claim({
        id: "cnull",
        employeeId: null,
        firstName: "=1+2",
        lastName: "ทดสอบ",
        position: "เจ้าหน้าที่",
        department: null,
        countDates: "1.5",
        amount: "2500.50",
      }),
    ],
    approvalSteps: overrides.approvalSteps ?? [
      {
        id: "step-1",
        monthlyRequestCollectionId: "mrc-1",
        stage: "HPA_CHECK",
        status: "APPROVED",
        reviewerId: "hpa-1",
        reviewedAt: REVIEWED_AT,
        reviewerNameAtApproval: "สมชาย ใจดี",
        reviewerPositionAtApproval: "ผู้จัดการแผนก",
        remark: null,
        createdAt: new Date("2026-09-05"),
        updatedAt: null,
        reviewer: {
          id: "hpa-1",
          firstName: "สมชาย",
          lastName: "ใจดี",
          positionShort: null,
          positionLevel: null,
        },
        signatureData: null,
      },
    ],
  };
}

async function openSheet(mrc: MrcSummaryPrintData) {
  const buffer = await buildMrcSummaryXlsx(mrc, NOW);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
}

function textValues(sheet: ExcelJS.Worksheet): string[] {
  const values: string[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        values.push(String(cell.value));
      }
    });
  });
  return values;
}

describe("buildMrcSummaryXlsx", () => {
  it("mirrors the print summary content", async () => {
    const mrc = fixture();
    const sheet = await openSheet(mrc);

    expect(sheet.getCell(1, 1).value).toBe("สรุปรายการเบิกเสี่ยงภัยพิเศษ");
    expect(sheet.getCell(2, 1).value).toBe(
      `ประจำ เดือน ${monthDisplay(mrc.collectForMonth)}`,
    );
    expect(String(sheet.getCell(3, 1).value)).toBe(
      `วันที่พิมพ์: ${longDateDisplay(NOW, "", { timeZone: "Asia/Bangkok" })}`,
    );

    expect([
      sheet.getCell(5, 1).value,
      sheet.getCell(5, 2).value,
      sheet.getCell(5, 3).value,
      sheet.getCell(5, 4).value,
      sheet.getCell(5, 5).value,
      sheet.getCell(5, 6).value,
    ]).toEqual([
      "ลำดับ",
      "รหัสพนักงาน",
      "ชื่อ-สกุล",
      "ตำแหน่ง/สังกัด",
      "จำนวนวัน",
      "จำนวนเงิน (บาท)",
    ]);

    // Rows sorted by employeeId: null, "000001", "000003".
    expect(sheet.getCell(6, 1).value).toBe(1);
    expect(sheet.getCell(6, 2).value).toBe("-");
    expect(sheet.getCell(6, 3).value).toBe("=1+2 ทดสอบ");
    expect(sheet.getCell(6, 4).value).toBe("เจ้าหน้าที่");
    expect(sheet.getCell(6, 5).value).toBe(1.5);
    expect(sheet.getCell(6, 5).numFmt).toBe("0.##");
    expect(sheet.getCell(6, 6).value).toBe(2500.5);
    expect(sheet.getCell(6, 6).numFmt).toBe("#,##0.00");

    expect(sheet.getCell(7, 1).value).toBe(2);
    expect(sheet.getCell(7, 2).value).toBe("000001");
    expect(sheet.getCell(7, 3).value).toBe("สมชาย ใจดี");
    expect(sheet.getCell(7, 4).value).toBe("พนักงาน / กฟฟ.2");
    expect(sheet.getCell(7, 5).value).toBe("-");
    expect(sheet.getCell(7, 6).value).toBe("-");

    expect(sheet.getCell(8, 1).value).toBe(3);
    expect(sheet.getCell(8, 2).value).toBe("000003");
    expect(sheet.getCell(8, 3).value).toBe("สมศรี รักดี");
    expect(sheet.getCell(8, 4).value).toBe("พนักงานช่าง / กฟฟ.1");
    expect(sheet.getCell(8, 5).value).toBe(2);
    expect(sheet.getCell(8, 6).value).toBe(1500);
    expect(sheet.getCell(8, 6).numFmt).toBe("#,##0.00");

    expect(sheet.getCell(9, 1).value).toBe("รวมทั้งสิ้น");
    expect(sheet.getCell(9, 5).value).toBe(3.5);
    expect(sheet.getCell(9, 6).value).toBe(4000.5);

    expect(sheet.getCell(11, 2).value).toBe("หผ. อนุมัติ");
    expect(sheet.getCell(12, 2).value).toBe("(สมชาย ใจดี)");
    expect(sheet.getCell(13, 2).value).toBe("ผู้จัดการแผนก");
    expect(sheet.getCell(14, 2).value).toBe(
      longDateDisplay(REVIEWED_AT, "", { timeZone: "Asia/Bangkok" }),
    );
    expect(sheet.getCell(15, 2).value).toBe("✓ อนุมัติ");

    expect(sheet.getCell(17, 1).value).toBe("MRC ID: mrc-1");
    expect(sheet.getCell(18, 1).value).toBe(
      `เอกสารนี้จัดทำโดยระบบ Special Risk Allowance Workflow · พิมพ์เมื่อ ${longDateDisplay(NOW, "", { timeZone: "Asia/Bangkok" })}`,
    );
  });

  it("writes user-controlled text as literal cell text, never as a formula", async () => {
    const sheet = await openSheet(fixture());
    const cell = sheet.getCell(6, 3);
    expect(cell.value).toBe("=1+2 ทดสอบ");
    expect(cell.formula).toBeUndefined();
  });

  it("renders zero totals and the fallback approval name when there are no claims", async () => {
    const sheet = await openSheet(fixture({ expenseClaims: [], approvalSteps: [] }));

    expect(sheet.getCell(6, 1).value).toBe("รวมทั้งสิ้น");
    expect(sheet.getCell(6, 5).value).toBe(0);
    expect(sheet.getCell(6, 6).value).toBe(0);

    expect(sheet.getCell(8, 2).value).toBe("หผ. อนุมัติ");
    expect(sheet.getCell(9, 2).value).toBe("(……………………………)");
    expect(textValues(sheet).some((v) => v.includes("✓"))).toBe(false);
  });

  it("renders the rejection remark and omits the approval tick", async () => {
    const base = fixture({ expenseClaims: [] });
    const sheet = await openSheet(
      fixture({
        expenseClaims: [],
        approvalSteps: [
          {
            ...base.approvalSteps[0],
            status: "REJECTED",
            reviewerNameAtApproval: "สมหญิง แกร่งกล้า",
            reviewerPositionAtApproval: "หัวหน้าแผนก",
            remark: "ยอดไม่ครบถ้วน",
          },
        ],
      }),
    );

    const values = textValues(sheet);
    expect(values).toContain("ปฏิเสธ: ยอดไม่ครบถ้วน");
    expect(values.some((v) => v.includes("✓"))).toBe(false);
  });
});
