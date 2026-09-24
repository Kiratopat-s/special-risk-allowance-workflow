"use client";

import { useState } from "react";
import { Button, ToggleButton, ToggleButtonGroup, useColorScheme } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { monthLabel, formatMoney } from "@/lib/domains/analytics/format";
import { ANALYTICS_STATUSES, STATUS_LABELS, type AnalyticsReport } from "@/lib/domains/analytics/types";
import type { ClaimDocumentStatus } from "@/lib/shared/types";

const LIGHT_COLORS = ["#667080", "#9a5b18", "#816929", "#4176a5", "#765a9d", "#168675", "#bd433d", "#697681"];
const DARK_COLORS = ["#b3bdce", "#e3ad6a", "#dec571", "#7bb6eb", "#c4a8e9", "#63cbb7", "#ff9b91", "#9eacbb"];
const axisMoney = (value: number) => new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function ReportCharts({ report, onDrill, print = false }: {
  report: AnalyticsReport; print?: boolean;
  onDrill?: (month: string, status?: ClaimDocumentStatus) => void;
}) {
  const [mode, setMode] = useState<"count" | "amount">("count");
  const { mode: colorMode, systemMode } = useColorScheme();
  const dark = !print && (colorMode === "dark" || (colorMode === "system" && systemMode === "dark"));
  const colors = dark ? DARK_COLORS : LIGHT_COLORS;
  const labels = report.months.map((month) => `${monthLabel(month.key)}${month.future ? " *" : ""}`);
  const missingMonths = report.months.filter((month) => month.total.missingAmountCount > 0);
  const visibleStatuses = ANALYTICS_STATUSES.filter((status) => report.filters.statuses.includes(status));
  return <div className="analytics-charts">
    <section className="document-panel analytics-chart-panel" aria-labelledby="analytics-amount-chart-title">
      <div className="analytics-section-heading"><div><h2 id="analytics-amount-chart-title">ยอดขอเบิกและยอดอนุมัติรายเดือน</h2>
        <p className="analytics-help">หน่วยบาท · ยอดอนุมัติเป็นส่วนหนึ่งของยอดขอเบิก</p></div></div>
      <div className="analytics-chart-scroll"><div className="analytics-chart-canvas" style={{ minWidth: print ? 0 : Math.max(660, report.months.length * 66) }}>
        <BarChart height={310} width={print ? 990 : undefined} skipAnimation
          xAxis={[{ scaleType: "band", data: labels, tickLabelStyle: { fontSize: 11 } }]}
          yAxis={[{ valueFormatter: axisMoney, width: 70 }]}
          series={[
            { id: "requested", label: "ยอดที่ขอเบิก", color: dark ? "#f18b74" : "#c64d37", data: report.months.map((month) => month.future && month.total.count === 0 ? null : month.requested.amount === null ? null : Number(month.requested.amount)), valueFormatter: (_value, context) => `${formatMoney(report.months[context.dataIndex].requested.amount)} บาท` },
            { id: "approved", label: "ยอดอนุมัติแล้ว", color: colors[5], data: report.months.map((month) => month.future && month.total.count === 0 ? null : month.approved.amount === null ? null : Number(month.approved.amount)), valueFormatter: (_value, context) => `${formatMoney(report.months[context.dataIndex].approved.amount)} บาท` },
          ]}
          onItemClick={onDrill ? (_event, item) => onDrill(report.months[item.dataIndex].key) : undefined}
          grid={{ horizontal: true }} margin={{ left: 8, right: 20, top: 15, bottom: 10 }}
          slotProps={{ legend: { direction: "horizontal", position: { vertical: "bottom", horizontal: "center" } } }} />
      </div></div>
      <ChartFootnote report={report} missingMonths={missingMonths.length} />
      {!print && <details className="analytics-chart-data"><summary>ดูข้อมูลกราฟยอดเงินเป็นตาราง</summary>
        <div className="analytics-table-scroll"><table className="analytics-table"><caption className="sr-only">ยอดขอเบิกและยอดอนุมัติรายเดือน หน่วยบาท</caption>
          <thead><tr><th scope="col">เดือน</th><th scope="col">ยอดที่ขอเบิก</th><th scope="col">ยอดอนุมัติแล้ว</th><th scope="col">เอกสารไม่ระบุยอดเงิน</th></tr></thead>
          <tbody>{report.months.map((month) => <tr key={month.key}><th scope="row"><Button onClick={() => onDrill?.(month.key)}>{monthLabel(month.key)}</Button>{month.future && <small className="analytics-future">ยังไม่ถึงช่วงเวลา</small>}</th>
            <td>{formatMoney(month.requested.amount)}</td><td>{formatMoney(month.approved.amount)}</td><td>{month.total.missingAmountCount}</td></tr>)}</tbody>
        </table></div></details>}
    </section>
    <section className="document-panel analytics-chart-panel" aria-labelledby="analytics-status-chart-title">
      <div className="analytics-section-heading"><div><h2 id="analytics-status-chart-title">สถานะคำขอรายเดือน</h2>
        <p className="analytics-help">{mode === "count" ? "จำนวนเอกสาร" : "ยอดเงินหน่วยบาท"} แยกตามสถานะปัจจุบัน</p></div>
        {!print && <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_event, value) => { if (value) setMode(value); }} aria-label="หน่วยกราฟสถานะ">
          <ToggleButton value="count">จำนวนเอกสาร</ToggleButton><ToggleButton value="amount">ยอดเงิน</ToggleButton>
        </ToggleButtonGroup>}
      </div>
      <div className="analytics-chart-scroll"><div className="analytics-chart-canvas" style={{ minWidth: print ? 0 : Math.max(660, report.months.length * 66) }}>
        <BarChart height={310} width={print ? 990 : undefined} skipAnimation hideLegend
          xAxis={[{ scaleType: "band", data: labels, tickLabelStyle: { fontSize: 11 } }]}
          yAxis={[{ valueFormatter: mode === "amount" ? axisMoney : (value: number) => value.toLocaleString("th-TH"), tickMinStep: mode === "count" ? 1 : undefined, width: 70 }]}
          series={visibleStatuses.map((status) => ({
            id: status, label: STATUS_LABELS[status], color: colors[ANALYTICS_STATUSES.indexOf(status)], stack: "statuses",
            data: report.months.map((month) => month.future && month.total.count === 0 ? null : mode === "count" ? month.statuses[status].count : month.statuses[status].amount === null ? null : Number(month.statuses[status].amount)),
            valueFormatter: (_value, context) => mode === "count" ? `${report.months[context.dataIndex].statuses[status].count.toLocaleString("th-TH")} เอกสาร` : `${formatMoney(report.months[context.dataIndex].statuses[status].amount)} บาท`,
          }))}
          onItemClick={onDrill ? (_event, item) => onDrill(report.months[item.dataIndex].key, item.seriesId as ClaimDocumentStatus) : undefined}
          grid={{ horizontal: true }} margin={{ left: 8, right: 20, top: 15, bottom: 10 }} />
      </div></div>
      <ul className="analytics-chart-legend" aria-label="คำอธิบายสีสถานะ">{visibleStatuses.map((status) => <li key={status}><span style={{ background: colors[ANALYTICS_STATUSES.indexOf(status)] }} aria-hidden="true" />{STATUS_LABELS[status]}</li>)}</ul>
      <ChartFootnote report={report} missingMonths={mode === "amount" ? missingMonths.length : 0} />
      {!print && <details className="analytics-chart-data"><summary>ดูข้อมูลกราฟสถานะเป็นตาราง</summary>
        <div className="analytics-table-scroll"><table className="analytics-table"><caption className="sr-only">สถานะคำขอรายเดือน หน่วย{mode === "count" ? "เอกสาร" : "บาท"}</caption>
          <thead><tr><th scope="col">เดือน</th>{visibleStatuses.map((status) => <th key={status} scope="col">{STATUS_LABELS[status]}</th>)}</tr></thead>
          <tbody>{report.months.map((month) => <tr key={month.key}><th scope="row">{monthLabel(month.key)}{month.future && <small className="analytics-future">ยังไม่ถึงช่วงเวลา</small>}</th>
            {visibleStatuses.map((status) => <td key={status}><Button onClick={() => onDrill?.(month.key, status)} aria-label={`กรอง ${monthLabel(month.key)} ${STATUS_LABELS[status]}`}>
              {mode === "count" ? month.statuses[status].count.toLocaleString("th-TH") : formatMoney(month.statuses[status].amount)}
            </Button>{mode === "amount" && month.statuses[status].missingAmountCount > 0 && <small className="analytics-future">ไม่ระบุยอด {month.statuses[status].missingAmountCount} รายการ</small>}</td>)}</tr>)}</tbody>
        </table></div></details>}
    </section>
  </div>;
}

function ChartFootnote({ report, missingMonths }: { report: AnalyticsReport; missingMonths: number }) {
  return <p className="analytics-help analytics-chart-footnote">
    เดือนที่ไม่มีเอกสารแสดงศูนย์{report.months.some((month) => month.future) && " · * ยังไม่ถึงช่วงเวลา หากมีคำขอล่วงหน้าจะแสดงยอดที่บันทึกไว้"}
    {missingMonths > 0 && ` · ${missingMonths} เดือนมีเอกสารไม่ระบุยอดเงิน กราฟแสดงเฉพาะยอดที่ทราบ`}
  </p>;
}
