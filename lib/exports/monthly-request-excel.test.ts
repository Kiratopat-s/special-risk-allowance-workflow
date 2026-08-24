import { describe, expect, test } from "bun:test";
import type { MonthlyRequestCollectionWithRelations } from "@/lib/domains/monthly-request-collection";
import {
  buildMrcExportFilename,
  buildMrcWorkbook,
  formatExcelDate,
  formatEmployeeIdForExcel,
  formatThaiBuddhistDate,
  formatThaiBuddhistMonth,
  sanitizeExcelCell,
} from "./monthly-request-excel";

const snapshot = {
  id: "mrc-1",
  departmentId: "dept-1",
  collectorId: "user-collector",
  collectForMonth: new Date("2026-08-01T00:00:00.000Z"),
  batchNo: 2,
  status: "FINALIZED",
  claimCount: 1,
  countDates: 1,
  amount: 150,
  snapshotVersion: 1,
  snapshotHash: "abc123",
  finalizedAt: new Date("2026-08-09T08:00:00.000Z"),
  finalizedById: "user-collector",
  paperApprovedAt: null,
  allDoneNote: null,
  allDoneAt: null,
  allDoneById: null,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  voidedAt: null,
  voidedById: null,
  voidReason: null,
  createdAt: new Date("2026-08-09T07:00:00.000Z"),
  updatedAt: new Date("2026-08-09T08:00:00.000Z"),
  department: { id: "dept-1", name: "ฝ่าย / ทดสอบ", shortName: "ฝทส." },
  collector: {
    id: "user-collector",
    firstName: "ผู้รวบรวม",
    lastName: "ทดสอบ",
    employeeId: "999999",
  },
  finalizedBy: null,
  allDoneBy: null,
  cancelledBy: null,
  voidedBy: null,
  replacementSources: [],
  items: [
    {
      id: "item-1",
      expenseClaimId: "claim-1",
      claimRevisionId: "revision-1",
      claimRevisionNo: 1,
      addedById: "user-collector",
      addedAt: new Date("2026-08-09T07:00:00.000Z"),
      removedAt: null,
      removalReason: null,
      rowNo: 1,
      employeeIdSnapshot: "000123",
      firstNameSnapshot: "=unsafe",
      lastNameSnapshot: "ผู้ทดสอบ",
      positionShortSnapshot: "พชง.",
      positionLevelSnapshot: "5",
      departmentIdSnapshot: "dept-1",
      departmentNameSnapshot: "ฝ่ายทดสอบ",
      departmentShortSnapshot: "ฝทส.",
      dayCountSnapshot: 1,
      amountSnapshot: 150,
      remarkSnapshot: "+formula",
      claimStatus: "COLLECTED",
      dates: [
        {
          id: "date-1",
          workDate: new Date("2026-08-09T00:00:00.000Z"),
          offSiteWorkIdSnapshot: "osw-1",
          offSiteWorkRefSnapshot: "ref-1",
          dayType: "DUTY",
          holidayType: "PUBLIC_HOLIDAY",
          holidayName: "วันหยุด",
          dailyRate: 150,
          weSafeCodes: [{ id: "code-1", code: "WS-SECRET" }],
        },
      ],
    },
  ],
} as MonthlyRequestCollectionWithRelations;

describe("Excel-safe values and dates", () => {
  test("neutralizes formula-prefixed text", () => {
    expect(sanitizeExcelCell("=HYPERLINK()")).toBe("'=HYPERLINK()");
    expect(sanitizeExcelCell("  +1")).toBe("'  +1");
    expect(sanitizeExcelCell("normal")).toBe("normal");
    expect(formatEmployeeIdForExcel("123")).toBe("000123");
  });

  test("formats dates deterministically with Buddhist year", () => {
    expect(formatExcelDate("2026-08-09")).toBe("2026-08-09");
    expect(formatThaiBuddhistDate("2026-08-09")).toBe("09/08/2569");
    expect(formatThaiBuddhistMonth("2026-08-09")).toContain("2569");
  });
});

describe("MRC workbook", () => {
  test("builds the exact copy-friendly sheets with typed cells", () => {
    const workbook = buildMrcWorkbook(snapshot);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Data",
      "Dates",
      "Summary",
    ]);

    const data = workbook.getWorksheet("Data")!;
    expect(data.getRow(1).values).toEqual([
      undefined,
      "ลำดับ",
      "รหัสพนักงาน",
      "ชื่อ",
      "นามสกุล",
      "ตำแหน่ง/ระดับ",
      "จำนวนวัน",
      "ยอดเงิน",
    ]);
    expect(data.getCell("B2").value).toBe("000123");
    expect(data.getCell("B2").numFmt).toBe("@");
    expect(data.getCell("C2").value).toBe("'=unsafe");
    expect(data.getCell("G2").value).toBe(150);
    expect(data.getCell("G2").numFmt).toBe("#,##0.00");
    expect(data.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(data.model.merges).toEqual([]);

    const dates = workbook.getWorksheet("Dates")!;
    const dateHeaderValues = dates.getRow(1).values;
    const dateHeaders = (Array.isArray(dateHeaderValues)
      ? dateHeaderValues
      : []
    ).map((value) => String(value));
    expect(dateHeaders.includes("WeSafe code")).toBe(false);
    expect(dates.getCell("A2").value).toBe("claim-1");
    expect(dates.getCell("C2").value).toBeInstanceOf(Date);
    expect(dates.getCell("D2").value).toBe("09/08/2569");
    expect(dates.getCell("E2").value).toBe(9);
    expect(dates.model.merges).toEqual([]);
  });

  test("uses the approved deterministic filename convention", () => {
    expect(buildMrcExportFilename(snapshot)).toBe(
      "MRC_ฝทส._2026-08_B2.xlsx",
    );
  });
});
