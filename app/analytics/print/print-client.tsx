"use client";

import { Button } from "@mui/material";
import { Printer } from "lucide-react";
import { analyticsQuery } from "@/lib/domains/analytics/query";
import { reportPeriodLabel } from "@/lib/domains/analytics/format";
import type { AnalyticsReport, AnalyticsSort, AnalyticsView } from "@/lib/domains/analytics/types";
import { AppliedFilters, ReportMetrics, ReportNotes, SummaryTable } from "../report-summary";
import { ReportCharts } from "../report-charts";

export function AnalyticsPrint({ report, view, sort }: { report: AnalyticsReport; view: AnalyticsView; sort: AnalyticsSort }) {
  const query = analyticsQuery(report.filters);
  query.set("view", view); query.set("sort", sort);
  return <main className="analytics-print-page">
    <div className="analytics-print-controls"><Button component="a" href={`/analytics?${query}`} variant="outlined">กลับไปที่รายงาน</Button>
      <Button variant="contained" startIcon={<Printer size={17} />} onClick={() => window.print()}>พิมพ์ / บันทึก PDF</Button>
      <p>เลือกกระดาษ A4 แนวนอน และบันทึกเป็น PDF ในหน้าต่างพิมพ์</p>
    </div>
    <header className="analytics-print-header"><h1>รายงานและสถิติการขอเบิก</h1><p>Special Risk Allowance Workflow · การไฟฟ้าส่วนภูมิภาค</p>
      <h2>{reportPeriodLabel(report.filters)}</h2><AppliedFilters report={report} />
      <p className="analytics-help">จัดทำเมื่อ {new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(report.generatedAt))} น. · สรุปทั้งองค์กร</p>
    </header>
    <ReportMetrics summary={report.summary} />
    <ReportNotes report={report} />
    <ReportCharts report={report} print />
    <SummaryTable report={report} view={view} sort={sort} print />
    <footer className="analytics-print-footer">รายงานสรุปตามตัวกรอง · ไม่รวมรายละเอียดรายบุคคล · ยอดอนุมัติในระบบไม่ใช่หลักฐานการจ่ายเงินจริง</footer>
  </main>;
}
