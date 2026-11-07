/**
 * MRC summary .xlsx builder — mirrors the print summary page content.
 *
 * No formula-injection escaping is needed (unlike CSV): exceljs stores plain
 * string cell values as shared strings, so a leading "=" is literal text.
 */
import ExcelJS from "exceljs";
import { longDateDisplay, monthDisplay } from "@/lib/shared/format";
import type { MrcSummaryPrintData } from "./types";

// Parity with app/monthly-request-collection/[id]/print/page.tsx:18-31
// (the shared decimalText in lib/shared/format.ts has different zero semantics).
function decimalToNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (typeof v === "object" && "toString" in (v as object)) {
    return parseFloat(String((v as { toString(): string }).toString()));
  }
  return 0;
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

export async function buildMrcSummaryXlsx(
  mrc: MrcSummaryPrintData,
  now: Date = new Date(),
): Promise<Buffer> {
  const printedDate = longDateDisplay(now, "", { timeZone: "Asia/Bangkok" });
  const forMonth = monthDisplay(mrc.collectForMonth);

  const claims = [...mrc.expenseClaims].sort((a, b) =>
    (a.claimant.employeeId ?? "").localeCompare(b.claimant.employeeId ?? ""),
  );

  const totalDates = claims.reduce(
    (sum, claim) => sum + decimalToNumber(claim.countDates),
    0,
  );
  const totalAmount = claims.reduce(
    (sum, claim) => sum + decimalToNumber(claim.amount),
    0,
  );

  const hpaStep = mrc.approvalSteps.find((s) => s.stage === "HPA_CHECK");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("สรุปรายการเบิก");
  sheet.columns = [
    { width: 8 },
    { width: 14 },
    { width: 28 },
    { width: 38 },
    { width: 12 },
    { width: 18 },
  ];

  let row = 1;

  sheet.mergeCells(row, 1, row, 6);
  const titleCell = sheet.getCell(row, 1);
  titleCell.value = "สรุปรายการเบิกเสี่ยงภัยพิเศษ";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center" };
  row += 1;

  sheet.mergeCells(row, 1, row, 6);
  const subtitleCell = sheet.getCell(row, 1);
  subtitleCell.value = `ประจำ เดือน ${forMonth}`;
  subtitleCell.alignment = { horizontal: "center" };
  row += 1;

  sheet.getCell(row, 1).value = `วันที่พิมพ์: ${printedDate}`;
  row += 2;

  const headers = [
    "ลำดับ",
    "รหัสพนักงาน",
    "ชื่อ-สกุล",
    "ตำแหน่ง/สังกัด",
    "จำนวนวัน",
    "จำนวนเงิน (บาท)",
  ];
  headers.forEach((label, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF5F5F5" },
    };
    cell.border = thinBorder;
  });
  row += 1;

  claims.forEach((claim, index) => {
    const dates = decimalToNumber(claim.countDates);
    const amount = decimalToNumber(claim.amount);
    const values: ExcelJS.CellValue[] = [
      index + 1,
      claim.claimant.employeeId ?? "-",
      `${claim.claimant.firstName} ${claim.claimant.lastName}`,
      claim.claimantPositionAtSubmission +
        (claim.claimant.department?.shortName
          ? ` / ${claim.claimant.department.shortName}`
          : ""),
      dates !== 0 ? dates : "-",
      amount > 0 ? amount : "-",
    ];
    values.forEach((value, colIndex) => {
      const cell = sheet.getCell(row, colIndex + 1);
      cell.value = value;
      cell.border = thinBorder;
      if (colIndex === 0 || colIndex === 1 || colIndex === 4) {
        cell.alignment = { horizontal: "center" };
      }
    });
    if (dates !== 0) sheet.getCell(row, 5).numFmt = "0.##";
    if (amount > 0) sheet.getCell(row, 6).numFmt = "#,##0.00";
    row += 1;
  });

  sheet.mergeCells(row, 1, row, 4);
  const totalLabelCell = sheet.getCell(row, 1);
  totalLabelCell.value = "รวมทั้งสิ้น";
  totalLabelCell.alignment = { horizontal: "center" };
  const totalDatesCell = sheet.getCell(row, 5);
  totalDatesCell.value = totalDates;
  totalDatesCell.numFmt = "0.##";
  totalDatesCell.alignment = { horizontal: "center" };
  const totalAmountCell = sheet.getCell(row, 6);
  totalAmountCell.value = totalAmount;
  totalAmountCell.numFmt = "#,##0.00";
  for (let col = 1; col <= 6; col += 1) {
    const cell = sheet.getCell(row, col);
    cell.font = { bold: true };
    cell.border = thinBorder;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F0F0" },
    };
  }
  row += 2;

  const approvalLines = [
    "หผ. อนุมัติ",
    hpaStep?.reviewerNameAtApproval
      ? `(${hpaStep.reviewerNameAtApproval})`
      : "(……………………………)",
    hpaStep?.reviewerPositionAtApproval ?? "",
    hpaStep?.reviewedAt
      ? longDateDisplay(hpaStep.reviewedAt, "", { timeZone: "Asia/Bangkok" })
      : "",
  ];
  if (hpaStep?.status === "REJECTED" && hpaStep.remark) {
    approvalLines.push(`ปฏิเสธ: ${hpaStep.remark}`);
  }
  if (hpaStep?.status === "APPROVED") {
    approvalLines.push("✓ อนุมัติ");
  }
  approvalLines.forEach((line) => {
    sheet.mergeCells(row, 2, row, 6);
    const cell = sheet.getCell(row, 2);
    cell.value = line;
    cell.alignment = { horizontal: "center" };
    row += 1;
  });

  row += 1;
  sheet.getCell(row, 1).value = `MRC ID: ${mrc.id}`;
  sheet.getCell(row, 1).font = { color: { argb: "FF555555" }, size: 11 };
  row += 1;
  sheet.getCell(row, 1).value = `เอกสารนี้จัดทำโดยระบบ Special Risk Allowance Workflow · พิมพ์เมื่อ ${printedDate}`;
  sheet.getCell(row, 1).font = { color: { argb: "FF555555" }, size: 11 };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
