"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, LinearProgress } from "@mui/material";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Printer } from "lucide-react";
import { analyticsQuery } from "@/lib/domains/analytics/query";
import { formatMoney, monthLabel, reportPeriodLabel } from "@/lib/domains/analytics/format";
import { STATUS_LABELS, type AnalyticsClaimPage, type AnalyticsFilters, type AnalyticsReport, type AnalyticsRow, type AnalyticsSort, type AnalyticsView } from "@/lib/domains/analytics/types";
import type { ClaimDocumentStatus } from "@/lib/shared/types";
import { AnalyticsFiltersForm } from "./analytics-filters";
import { AppliedFilters, ReportMetrics, ReportNotes, SummaryTable, VIEW_LABELS } from "./report-summary";
import { ReportCharts } from "./report-charts";

export function AnalyticsClient({ report, claims, claimsError, view, sort }: {
  report: AnalyticsReport; claims: AnalyticsClaimPage | null; claimsError: string | null;
  view: AnalyticsView; sort: AnalyticsSort;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const query = analyticsQuery(report.filters);
  query.set("view", view);
  query.set("sort", sort);
  function navigate(filters: AnalyticsFilters, options?: { view?: AnalyticsView; sort?: AnalyticsSort; page?: number }) {
    const next = analyticsQuery(filters);
    next.set("view", options?.view ?? view);
    next.set("sort", options?.sort ?? sort);
    if ((options?.page ?? 1) > 1) next.set("page", String(options?.page));
    startTransition(() => router.push(`/analytics?${next}`, { scroll: false }));
  }
  function drillMonth(month: string, status?: ClaimDocumentStatus) {
    navigate({ ...report.filters, interval: "month", period: 1, fromMonth: month, toMonth: month,
      statuses: status ? [status] : report.filters.statuses });
  }
  function drillRow(rowView: AnalyticsView, row: AnalyticsRow) {
    if (rowView === "month") drillMonth(row.key);
    else if (rowView === "department") navigate({ ...report.filters, departmentIds: [row.key] });
    else navigate({ ...report.filters, statuses: [row.key as ClaimDocumentStatus] });
  }
  return <div className="workspace-content analytics-page" aria-busy={pending}>
    <div className="page-heading analytics-heading"><div><h1>รายงานและสถิติ</h1>
      <p>ดูยอดขอเบิก เปรียบเทียบแผนก และติดตามสถานะคำขอของทั้งองค์กร</p></div>
      <div className="analytics-actions">
        <Button component="a" href={`/api/analytics/export?${query}`} variant="outlined" startIcon={<Download size={16} />} disabled={pending}>CSV · {VIEW_LABELS[view]}</Button>
        <Button component="a" href={`/analytics/print?${query}`} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<Printer size={16} />} disabled={pending}>พิมพ์ / PDF</Button>
      </div>
    </div>
    <AnalyticsFiltersForm key={analyticsQuery(report.filters).toString()} filters={report.filters} departments={report.departmentOptions}
      pending={pending} onApply={navigate} onReset={() => startTransition(() => router.push("/analytics", { scroll: false }))} />
    <div className="analytics-report-context" aria-live="polite">
      <h2>{reportPeriodLabel(report.filters)}</h2><AppliedFilters report={report} />
      <p className="analytics-help">จัดทำเมื่อ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(report.generatedAt))} น. · ข้อมูลสรุปทั้งองค์กร</p>
    </div>
    {pending && <LinearProgress aria-label="กำลังปรับรายงานตามตัวกรอง" />}
    {report.summary.total.count === 0 && <Alert severity="info">ไม่พบคำขอเบิกในช่วงเวลาและตัวกรองนี้ ลองเปลี่ยนช่วงเดือน แผนก หรือสถานะ</Alert>}
    <ReportMetrics summary={report.summary} />
    <ReportNotes report={report} />
    <ReportCharts report={report} onDrill={drillMonth} />
    <SummaryTable report={report} view={view} sort={sort} onView={(next) => navigate(report.filters, { view: next })}
      onSort={(next) => navigate(report.filters, { sort: next })} onDrill={drillRow} />
    <section className="document-panel" aria-labelledby="analytics-claims-title">
      <div className="analytics-section-heading"><div><h2 id="analytics-claims-title">รายการที่คุณมีสิทธิ์ดู</h2>
        <p className="analytics-help">รายละเอียดตามสิทธิ์ของคุณ จำนวนรายการอาจไม่เท่ากับยอดรวมองค์กรด้านบน · ส่งออกเฉพาะข้อมูลสรุป</p></div></div>
      {claimsError ? <Alert severity="error" className="m-5">{claimsError} <Button size="small" onClick={() => startTransition(() => router.refresh())}>ลองโหลดรายการอีกครั้ง</Button></Alert>
        : claims && <>
          {claims.restricted && claims.total === 0 ? <p className="analytics-empty">บัญชีนี้ยังไม่มีรายการที่มีสิทธิ์อ่านตามตัวกรอง คุณยังดูข้อมูลสรุปองค์กรได้</p>
            : <div className="analytics-table-scroll" role="region" aria-label="รายการคำขอที่มีสิทธิ์ดู" tabIndex={0}><table className="analytics-table analytics-claims-table">
              <caption className="sr-only">รายการคำขอที่คุณมีสิทธิ์ดู แสดงหน้าละ 20 รายการ</caption>
              <thead><tr><th scope="col">เดือนขอเบิก</th><th scope="col">ผู้ขอเบิก</th><th scope="col">แผนกในรายงาน</th><th scope="col">สถานะ</th><th scope="col">ยอดเงิน (บาท)</th><th scope="col">เอกสาร</th></tr></thead>
              <tbody>{claims.items.length === 0 ? <tr><td colSpan={6} className="analytics-empty">ไม่พบรายการที่คุณมีสิทธิ์ดูตามตัวกรองนี้</td></tr>
                : claims.items.map((claim) => <tr key={claim.id}><td>{monthLabel(claim.month)}</td><th scope="row">{claim.claimantName}</th><td>{claim.departmentName}</td>
                  <td><span className="analytics-status-label">{STATUS_LABELS[claim.status]}</span></td><td>{formatMoney(claim.amount)}</td>
                  <td><Button component={Link} href={`/dashboard?tab=expense-claims&claimId=${encodeURIComponent(claim.id)}`} size="small" endIcon={<ExternalLink size={14} />}
                    aria-label={`เปิดคำขอ ${claim.claimantName} ${monthLabel(claim.month)}`}>เปิดเอกสาร</Button></td></tr>)}</tbody>
            </table></div>}
          <div className="analytics-pagination"><p>{claims.total.toLocaleString("th-TH")} รายการ · หน้า {claims.page} จาก {Math.max(1, Math.ceil(claims.total / claims.pageSize))}</p>
            <div><Button size="small" disabled={pending || claims.page <= 1} onClick={() => navigate(report.filters, { page: claims.page - 1 })} startIcon={<ChevronLeft size={16} />}>ก่อนหน้า</Button>
              <Button size="small" disabled={pending || claims.page * claims.pageSize >= claims.total} onClick={() => navigate(report.filters, { page: claims.page + 1 })} endIcon={<ChevronRight size={16} />}>ถัดไป</Button></div>
          </div>
        </>}
    </section>
  </div>;
}
