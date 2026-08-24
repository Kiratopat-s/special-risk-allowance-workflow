import ExcelJS, {
  type Alignment,
  type CellValue,
  type Worksheet,
} from "exceljs";
import type { MonthlyRequestCollectionWithRelations } from "@/lib/domains/monthly-request-collection";

export type MrcWorkbookSnapshot = MonthlyRequestCollectionWithRelations;

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E3A5F" },
};

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

export function sanitizeExcelCell(value: string | null | undefined): string {
  if (!value) return "";
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function toExcelDate(value: Date | string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid Excel date");
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function formatExcelDate(value: Date | string): string {
  return toExcelDate(value).toISOString().slice(0, 10);
}

export function formatThaiBuddhistDate(value: Date | string): string {
  const date = toExcelDate(value);
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear() + 543}`;
}

export function formatThaiBuddhistMonth(value: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toExcelDate(value));
}

export function thaiShortWeekday(value: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    timeZone: "UTC",
  }).format(toExcelDate(value));
}

function safe(value: string | null | undefined): string {
  return sanitizeExcelCell(value);
}

function safeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? sanitizeExcelCell(normalized) : null;
}

export function formatEmployeeIdForExcel(
  value: string | null | undefined,
): string {
  const normalized = value?.trim() ?? "";
  return sanitizeExcelCell(
    /^\d{1,6}$/.test(normalized) ? normalized.padStart(6, "0") : normalized,
  );
}

function configureTabularSheet(
  sheet: Worksheet,
  options: { numericColumns?: number[]; dateColumns?: number[] } = {},
): void {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
  };
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.border = BORDER;
      const alignment: Partial<Alignment> = {
        vertical: "middle",
        wrapText: true,
      };
      if (options.numericColumns?.includes(columnNumber)) {
        alignment.horizontal = "right";
      }
      if (options.dateColumns?.includes(columnNumber)) {
        alignment.horizontal = "center";
        cell.numFmt = "dd/mm/yyyy";
      }
      cell.alignment = alignment;
    });
  });
  for (const columnNumber of options.numericColumns ?? []) {
    sheet.getColumn(columnNumber).numFmt = "#,##0.00";
  }
  for (const columnNumber of options.dateColumns ?? []) {
    sheet.getColumn(columnNumber).numFmt = "dd/mm/yyyy";
  }
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  mrc: MrcWorkbookSnapshot,
): void {
  const sheet = workbook.addWorksheet("Data", {
    properties: { defaultRowHeight: 22 },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = [
    { header: "ลำดับ", key: "rowNo", width: 8 },
    { header: "รหัสพนักงาน", key: "employeeId", width: 16 },
    { header: "ชื่อ", key: "firstName", width: 20 },
    { header: "นามสกุล", key: "lastName", width: 22 },
    { header: "ตำแหน่ง/ระดับ", key: "position", width: 28 },
    { header: "จำนวนวัน", key: "dayCount", width: 12 },
    { header: "ยอดเงิน", key: "amount", width: 16 },
  ];

  for (const item of mrc.items) {
    sheet.addRow({
      rowNo: item.rowNo,
      employeeId: formatEmployeeIdForExcel(item.employeeIdSnapshot),
      firstName: safe(item.firstNameSnapshot),
      lastName: safe(item.lastNameSnapshot),
      position: safe(
        [item.positionShortSnapshot, item.positionLevelSnapshot]
          .filter(Boolean)
          .join(" "),
      ),
      dayCount: item.dayCountSnapshot,
      amount: item.amountSnapshot,
    });
  }
  configureTabularSheet(sheet, { numericColumns: [6, 7] });
  sheet.getColumn(2).numFmt = "@";
  sheet.getColumn(6).numFmt = "0";
  sheet.getColumn(7).numFmt = "#,##0.00";
}

function addDatesSheet(
  workbook: ExcelJS.Workbook,
  mrc: MrcWorkbookSnapshot,
): void {
  const sheet = workbook.addWorksheet("Dates", {
    properties: { defaultRowHeight: 22 },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = [
    { header: "Claim ID", key: "claimId", width: 38 },
    { header: "รหัสพนักงาน", key: "employeeId", width: 16 },
    { header: "วันที่ (Excel)", key: "date", width: 16 },
    { header: "วันที่ พ.ศ. (dd/MM/BBBB)", key: "dateThai", width: 24 },
    { header: "เลขวันที่", key: "dayNumber", width: 11 },
    { header: "ชื่อวันย่อ", key: "weekday", width: 12 },
    { header: "เลขอ้างอิงใบนำตัว", key: "offsiteRef", width: 24 },
    { header: "ประเภทวัน", key: "dayType", width: 16 },
    { header: "ประเภทวันหยุด", key: "holidayType", width: 18 },
    { header: "ชื่อวันหยุด", key: "holidayName", width: 24 },
  ];

  for (const item of mrc.items) {
    for (const date of item.dates) {
      sheet.addRow({
        claimId: safe(item.expenseClaimId),
        employeeId: formatEmployeeIdForExcel(item.employeeIdSnapshot),
        date: toExcelDate(date.workDate),
        dateThai: formatThaiBuddhistDate(date.workDate),
        dayNumber: toExcelDate(date.workDate).getUTCDate(),
        weekday: thaiShortWeekday(date.workDate),
        offsiteRef: safeOptional(date.offSiteWorkRefSnapshot),
        dayType: date.dayType,
        holidayType: date.holidayType,
        holidayName: safeOptional(date.holidayName),
      });
    }
  }
  configureTabularSheet(sheet, { dateColumns: [3] });
  sheet.getColumn(2).numFmt = "@";
  sheet.getColumn(5).numFmt = "0";
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  mrc: MrcWorkbookSnapshot,
): void {
  const sheet = workbook.addWorksheet("Summary", {
    properties: { defaultRowHeight: 22 },
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = [
    { header: "รายการ", key: "label", width: 32 },
    { header: "ค่า", key: "value", width: 64 },
  ];
  const summary: Array<[string, CellValue]> = [
    ["MRC ID", mrc.id],
    ["เดือน", formatThaiBuddhistMonth(mrc.collectForMonth)],
    [
      "หน่วยงาน",
      safe(mrc.items[0]?.departmentNameSnapshot ?? mrc.department.name),
    ],
    [
      "ชื่อย่อหน่วยงาน",
      safeOptional(
        mrc.items[0]?.departmentShortSnapshot ?? mrc.department.shortName,
      ),
    ],
    ["Batch", mrc.batchNo],
    ["สถานะ", mrc.status],
    ["จำนวนคำขอ", mrc.claimCount],
    ["จำนวนวัน", mrc.countDates],
    ["ยอดรวม", mrc.amount],
    ["Snapshot version", mrc.snapshotVersion],
    ["Snapshot hash", safeOptional(mrc.snapshotHash)],
    ["Finalized by", safeOptional(mrc.finalizedById)],
    [
      "Finalized at",
      mrc.finalizedAt
        ? new Intl.DateTimeFormat("th-TH", {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "Asia/Bangkok",
          }).format(mrc.finalizedAt)
        : null,
    ],
    [
      "Paper approved at",
      mrc.paperApprovedAt
        ? new Intl.DateTimeFormat("th-TH", {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "Asia/Bangkok",
          }).format(mrc.paperApprovedAt)
        : null,
    ],
    ["Collector ID", mrc.collectorId],
    ["หมายเหตุ All Done", safeOptional(mrc.allDoneNote)],
  ];
  for (const [label, value] of summary) sheet.addRow({ label, value });
  configureTabularSheet(sheet);
  sheet.getCell("B10").numFmt = "#,##0.00";
}

export function buildMrcWorkbook(
  mrc: MrcWorkbookSnapshot,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Special Risk Allowance Workflow";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  addDataSheet(workbook, mrc);
  addDatesSheet(workbook, mrc);
  addSummarySheet(workbook, mrc);
  return workbook;
}

export async function writeMrcWorkbookBuffer(
  mrc: MrcWorkbookSnapshot,
): Promise<Buffer> {
  const workbook = buildMrcWorkbook(mrc);
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function buildMrcExportFilename(
  mrc: Pick<
    MrcWorkbookSnapshot,
    "collectForMonth" | "batchNo" | "department" | "items"
  >,
): string {
  const department = (
    mrc.items[0]?.departmentShortSnapshot ||
    mrc.items[0]?.departmentNameSnapshot ||
    mrc.department.shortName ||
    mrc.department.name
  )
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60) || "DEPARTMENT";
  const month = formatExcelDate(mrc.collectForMonth).slice(0, 7);
  return `MRC_${department}_${month}_B${mrc.batchNo ?? 0}.xlsx`;
}
