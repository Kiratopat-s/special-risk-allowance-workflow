"use client";

import { Alert, Button, MenuItem, Tab, Tabs, TextField } from "@mui/material";
import { formatMoney, sortedRows } from "@/lib/domains/analytics/format";
import { type AnalyticsMetric, type AnalyticsMetrics, type AnalyticsReport, type AnalyticsRow, type AnalyticsSort, type AnalyticsView, STATUS_LABELS } from "@/lib/domains/analytics/types";

export function Money({ metric, unit = false }: { metric: AnalyticsMetric; unit?: boolean }) {
  return <span className="analytics-money"><span className="analytics-money-value">{formatMoney(metric.amount)}{unit && <span className="analytics-money-unit">บาท</span>}</span>
    {metric.missingAmountCount > 0 && <small>ไม่ระบุยอด {metric.missingAmountCount.toLocaleString("th-TH")} รายการ</small>}
  </span>;
}

export function ReportMetrics({ summary }: { summary: AnalyticsMetrics }) {
  const cards = [
    { label: "ยอดที่ขอเบิก", metric: summary.requested, note: "รวมฉบับร่างและไม่อนุมัติ · ไม่รวมยกเลิก" },
    { label: "ยอดอนุมัติแล้ว", metric: summary.approved, note: "อนุมัติในระบบ · ยังไม่ใช่การจ่ายเงินจริง" },
    { label: "ยอดระหว่างดำเนินการ", metric: summary.inProgress, note: "ตั้งแต่ส่งคำขอจนถึงรวบรวมแล้ว" },
    { label: "ยอดฉบับร่าง", metric: summary.draft, note: "รวมอยู่ในยอดที่ขอเบิก" },
  ];
  return <section aria-label="ยอดสรุปตามตัวกรอง">
    <div className="analytics-metrics">{cards.map((card) => <div className="analytics-metric" key={card.label}>
      <h2>{card.label}</h2><p className="analytics-metric-amount"><Money metric={card.metric} unit /></p>
      <p className="analytics-metric-count">{card.metric.count.toLocaleString("th-TH")} เอกสาร</p><p className="analytics-help">{card.note}</p>
    </div>)}</div>
    <dl className="analytics-secondary-metrics">
      <div><dt>ผู้ขอเบิกไม่ซ้ำ</dt><dd>{summary.claimantCount.toLocaleString("th-TH")} <span>คน</span></dd></div>
      <div><dt>เฉลี่ยต่อผู้ขอเบิก</dt><dd>{summary.averagePerClaimant === null ? "คำนวณไม่ได้" : <>{formatMoney(summary.averagePerClaimant)} <span>บาท</span></>}</dd>
        {summary.averagePerClaimant === null && <p className="analytics-help">ไม่มีผู้ขอเบิก หรือมียอดเงินไม่ครบ</p>}</div>
      <div><dt>ค้างดำเนินการจากเดือนก่อน</dt><dd><Money metric={summary.backlog} unit /></dd><p className="analytics-help">{summary.backlog.count.toLocaleString("th-TH")} เอกสาร ภายในช่วงเวลาที่เลือก</p></div>
    </dl>
  </section>;
}

export function ReportNotes({ report }: { report: AnalyticsReport }) {
  const { summary } = report;
  return <div className="analytics-notes">
    {summary.total.missingAmountCount > 0 && <Alert severity="warning">มี {summary.total.missingAmountCount.toLocaleString("th-TH")} เอกสารที่ยังไม่ระบุยอดเงิน ตัวเลขแสดงเฉพาะยอดที่ทราบ โดยไม่ถือยอดที่ขาดเป็นศูนย์</Alert>}
    <p>รายงานใช้เดือนที่ขอเบิกและสถานะปัจจุบัน ไม่ใช่ประวัติสถานะ ณ สิ้นเดือนย้อนหลัง ยอดอนุมัติแล้วเป็นส่วนหนึ่งของยอดที่ขอเบิก</p>
    <p>แผนกอ้างอิงเวลาส่งคำขอครั้งแรก · ข้อมูลเก่าที่ใช้แผนก ณ วันปรับปรุงระบบ {summary.legacyDepartmentCount.toLocaleString("th-TH")} เอกสาร · เอกสารก่อนส่งที่ใช้แผนกปัจจุบัน {summary.provisionalDepartmentCount.toLocaleString("th-TH")} เอกสาร</p>
    {summary.legacyDepartmentCount > 0 && <p>ข้อมูลแผนกทดแทนของเอกสารเก่าไม่ยืนยันแผนกจริงในอดีต และจะไม่เปลี่ยนตามการย้ายแผนกภายหลัง</p>}
  </div>;
}

export const VIEW_LABELS: Record<AnalyticsView, string> = { month: "รายเดือน", department: "แผนก", status: "สถานะ" };

export function SummaryTable({ report, view, sort, onView, onSort, onDrill, print = false }: {
  report: AnalyticsReport; view: AnalyticsView; sort: AnalyticsSort; print?: boolean;
  onView?: (view: AnalyticsView) => void; onSort?: (sort: AnalyticsSort) => void;
  onDrill?: (view: AnalyticsView, row: AnalyticsRow) => void;
}) {
  const rows = sortedRows(view === "month" ? report.months : view === "department" ? report.departments : report.statuses, sort);
  return <section className="document-panel analytics-summary-table" aria-labelledby="analytics-table-title">
    <div className="analytics-section-heading"><div><h2 id="analytics-table-title">สรุป{VIEW_LABELS[view]}</h2>
      <p className="analytics-help">ยอดเงินหน่วยบาท · ยอดรวมคำนวณจากทุกเอกสารตามตัวกรอง</p></div>
      {!print && <TextField select label="เรียงข้อมูล" size="small" value={sort} onChange={(event) => onSort?.(event.target.value as AnalyticsSort)} sx={{ minWidth: 205 }}>
        <MenuItem value="label">{view === "month" ? "เดือนเก่าไปใหม่" : "ชื่อ"}</MenuItem>
        <MenuItem value="requested-desc">ยอดขอเบิกมากไปน้อย</MenuItem><MenuItem value="requested-asc">ยอดขอเบิกน้อยไปมาก</MenuItem>
        <MenuItem value="count-desc">เอกสารมากไปน้อย</MenuItem>
      </TextField>}
    </div>
    {!print && <Tabs value={view} onChange={(_event, value: AnalyticsView) => onView?.(value)} aria-label="มุมมองตารางสรุป" variant="scrollable">
      {(Object.entries(VIEW_LABELS) as [AnalyticsView, string][]).map(([value, label]) => <Tab key={value} value={value} label={label} />)}
    </Tabs>}
    <div className="analytics-table-scroll" tabIndex={0} role="region" aria-label={`ตารางสรุป${VIEW_LABELS[view]}`}>
      <table className="analytics-table"><caption className="sr-only">สรุป{VIEW_LABELS[view]} ยอดเงินหน่วยบาท ผู้ขอเบิกแต่ละแถวอาจเป็นคนเดียวกัน ยอดรวมจึงนับใหม่โดยไม่ซ้ำ</caption>
        <thead><tr><th scope="col">{VIEW_LABELS[view]}</th><th scope="col">เอกสารทั้งหมด</th><th scope="col">ยอดเงินทุกสถานะ</th><th scope="col">ยอดที่ขอเบิก</th><th scope="col">อนุมัติแล้ว</th><th scope="col">ระหว่างดำเนินการ</th><th scope="col">ผู้ขอเบิกไม่ซ้ำ</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={7} className="analytics-empty">ไม่พบข้อมูลตามตัวกรองนี้</td></tr> : rows.map((row) => <SummaryRow key={row.key} row={row} view={view} onDrill={onDrill} future={view === "month" && report.months.some((month) => month.key === row.key && month.future)} />)}</tbody>
        <tfoot><SummaryRow row={{ ...report.summary, key: "total", label: "รวมตามตัวกรอง" }} view={view} /></tfoot>
      </table>
    </div>
    <p className="analytics-help analytics-table-footnote">ยอดเงินทุกสถานะรวมรายการยกเลิกด้วย · จำนวนผู้ขอเบิกใช้กลุ่มยอดที่ขอเบิกและนับแต่ละคนครั้งเดียวในยอดรวม</p>
  </section>;
}

function SummaryRow({ row, view, onDrill, future }: { row: AnalyticsRow; view: AnalyticsView; onDrill?: (view: AnalyticsView, row: AnalyticsRow) => void; future?: boolean }) {
  return <tr><th scope="row">{onDrill ? <Button variant="text" onClick={() => onDrill(view, row)} className="analytics-drill" aria-label={`กรอง${VIEW_LABELS[view]} ${row.label}`}>{row.label}</Button> : row.label}
    {future && <small className="analytics-future">ยังไม่ถึงช่วงเวลา</small>}</th>
    <td>{row.total.count.toLocaleString("th-TH")}</td><td><Money metric={row.total} /></td><td><Money metric={row.requested} /></td>
    <td><Money metric={row.approved} /></td><td><Money metric={row.inProgress} /></td><td>{row.claimantCount.toLocaleString("th-TH")}</td></tr>;
}

export function AppliedFilters({ report }: { report: AnalyticsReport }) {
  const departments = report.filters.departmentIds.map((id) => report.departmentOptions.find((option) => option.id === id)?.name ?? "แผนกย้อนหลัง");
  return <div className="analytics-applied" aria-label="ตัวกรองที่กำลังแสดง">
    <span><strong>แผนก:</strong> {departments.length ? departments.join(", ") : "ทุกแผนก"}</span>
    <span><strong>สถานะ:</strong> {report.filters.statuses.length === 8 ? "ทุกสถานะ" : report.filters.statuses.map((status) => STATUS_LABELS[status]).join(", ")}</span>
  </div>;
}
