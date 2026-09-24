import { reportPeriodLabel, sortedRows } from "./format";
import { STATUS_LABELS, type AnalyticsMetrics, type AnalyticsReport, type AnalyticsSort, type AnalyticsView } from "./types";

/** Quotes/newlines are escaped; user-controlled strings cannot execute Excel formulas. */
export function csvCell(value: string | number | null): string {
  let text = value === null ? "ไม่ระบุ" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function reportCsv(report: AnalyticsReport, view: AnalyticsView, sort: AnalyticsSort): string {
  const rows = view === "department" ? report.departments : view === "status" ? report.statuses : report.months;
  const departments = report.filters.departmentIds.length
    ? report.filters.departmentIds.map((id) => report.departmentOptions.find((option) => option.id === id)?.name ?? "แผนกย้อนหลัง").join(", ") : "ทุกแผนก";
  const line = (values: (string | number | null)[]) => values.map(csvCell).join(",");
  const metricRow = (label: string, data: AnalyticsMetrics) => [label,
    data.total.count, data.total.amount, data.requested.count, data.requested.amount,
    data.approved.count, data.approved.amount, data.inProgress.count, data.inProgress.amount,
    data.draft.count, data.draft.amount, data.claimantCount, data.averagePerClaimant,
    data.backlog.count, data.backlog.amount, data.total.missingAmountCount,
    data.legacyDepartmentCount, data.provisionalDepartmentCount,
  ];
  return "\uFEFF" + [
    line(["รายงานและสถิติการขอเบิก", reportPeriodLabel(report.filters)]),
    line(["เวลาจัดทำ", report.generatedAt]), line(["แผนก", departments]),
    line(["สถานะ", report.filters.statuses.map((status) => STATUS_LABELS[status]).join(", ")]),
    line(["นิยาม", "ตามเดือนที่ขอเบิกและสถานะปัจจุบัน; ยอดขอเบิกรวมฉบับร่าง/ไม่อนุมัติ ไม่รวมยกเลิก; อนุมัติในระบบไม่ใช่ยอดจ่ายเงินจริง"]),
    line(["แผนกย้อนหลัง", "เอกสารเดิมใช้แผนก ณ วันปรับปรุงระบบ; รายการยังไม่ส่งใช้แผนกปัจจุบัน"]),
    line(["จำนวนผู้ขอเบิก", "นับคนไม่ซ้ำในแต่ละกลุ่ม ไม่บวกจำนวนคนรายเดือนหรือรายแผนกเป็นยอดรวม"]),
    line(["ข้อมูลไม่ครบ", "ยอดเงินรวมเฉพาะค่าที่ทราบ; ไม่ระบุหมายถึงไม่มีข้อมูล ไม่ใช่ศูนย์"]), "",
    line([view === "department" ? "แผนก" : view === "status" ? "สถานะ" : "เดือน",
      "เอกสารทั้งหมด", "ยอดทุกสถานะ (บาท)", "เอกสารขอเบิก", "ยอดขอเบิก (บาท)",
      "เอกสารอนุมัติ", "ยอดอนุมัติ (บาท)", "เอกสารระหว่างดำเนินการ", "ยอดระหว่างดำเนินการ (บาท)",
      "ฉบับร่าง", "ยอดฉบับร่าง (บาท)", "ผู้ขอเบิกไม่ซ้ำ", "เฉลี่ยต่อผู้ขอเบิก (บาท)",
      "เอกสารค้างเดือนก่อน", "ยอดค้างเดือนก่อน (บาท)", "รายการไม่ระบุยอด", "แผนกข้อมูลทดแทน", "แผนกปัจจุบันยังไม่ส่ง"]),
    ...sortedRows(rows, sort).map((row) => line(metricRow(
      view === "month" && row.key > report.currentMonth ? `${row.label} (ยังไม่ถึงช่วงเวลา)` : row.label, row))),
    line(metricRow("รวมทั้งหมด (ผู้ขอเบิกนับไม่ซ้ำ)", report.summary)),
  ].join("\r\n");
}
