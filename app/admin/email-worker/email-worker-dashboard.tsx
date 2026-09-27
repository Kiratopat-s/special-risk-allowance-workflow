"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, MenuItem, Skeleton, TextField } from "@mui/material";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { getEmailWorkerJob, getEmailWorkerOverview, listEmailWorkerJobs, retryEmailDelivery } from "@/app/actions/email-deliveries";
import type { EmailDashboardFilter } from "@/lib/domains/email-delivery/dashboard-types";
import { runServerAction } from "@/lib/deployment/client";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/workflow-ui/button";
import { Input } from "@/components/workflow-ui/input";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/workflow-ui/table";
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from "@/components/workflow-ui/dialog";
import { WorkerOverview } from "./overview";
import { JobDetails } from "./job-details";
import { deliveryLabels, displayMonth, displayTime, errorDescription } from "./presentation";
import { parseEmailWorkerQuery, patchEmailWorkerQuery } from "./query-state";
import { useLiveRead } from "./use-live-read";

const queryEvent = "email-worker:query-change";
function subscribeQuery(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(queryEvent, notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener(queryEvent, notify); };
}
const browserQuery = () => window.location.search;

function Filters({ filters, apply }: { filters: EmailDashboardFilter; apply: (values: Record<string, string | number | null | undefined>) => void }) {
  const [search, setSearch] = useState(filters.search || "");
  const [from, setFrom] = useState(filters.from || "");
  const [to, setTo] = useState(filters.to || "");
  return <form className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_180px_170px_170px_auto]" onSubmit={(event) => {
    event.preventDefault();
    apply({ search: search.trim(), from, to, page: 1 });
  }}>
    <div className="space-y-1.5"><Label htmlFor="worker-job-search">ค้นหางานอีเมล</Label><Input id="worker-job-search" placeholder="ชื่อ อีเมล รหัสงาน หรือเอกสาร" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={200} /></div>
    <TextField select label="สถานะงาน" size="small" value={filters.status || ""} onChange={(event) => apply({ status: event.target.value, page: 1 })}>
      <MenuItem value="">ทุกสถานะ</MenuItem>{Object.entries(deliveryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
    </TextField>
    <TextField type="date" label="จัดคิวตั้งแต่" value={from} onChange={(event) => setFrom(event.target.value)} size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || undefined } }} />
    <TextField type="date" label="จัดคิวถึง" value={to} onChange={(event) => setTo(event.target.value)} size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }} />
    <Button type="submit"><Search aria-hidden="true" className="h-4 w-4" />ค้นหา</Button>
  </form>;
}

export function EmailWorkerDashboard({ initialQuery = "" }: { initialQuery?: string }) {
  const query = useSyncExternalStore(subscribeQuery, browserQuery, () => initialQuery);
  const selected = useMemo(() => parseEmailWorkerQuery(query), [query]);
  const { page, status, search, from, to } = selected.filters;
  const filters = useMemo(() => ({ page, status, search, from, to }), [page, status, search, from, to]);
  const [revision, setRevision] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const denyAccess = useCallback(() => setAccessDenied(true), []);
  const navigate = useCallback((patch: Record<string, string | number | null | undefined>) => {
    const next = patchEmailWorkerQuery(window.location.search, patch);
    window.history.pushState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    window.dispatchEvent(new Event(queryEvent));
  }, []);
  const openJob = useCallback((id: string) => navigate({ deliveryId: id, attemptPage: 1 }), [navigate]);
  const closeJob = () => navigate({ deliveryId: null, attemptPage: null });
  const loadOverview = useCallback(() => getEmailWorkerOverview(), []);
  const loadList = useCallback(() => listEmailWorkerJobs(filters), [filters]);
  const loadDetail = useCallback(() => getEmailWorkerJob(selected.deliveryId!, selected.attemptPage), [selected.deliveryId, selected.attemptPage]);
  const overviewKey = `overview:${revision}`;
  const listKey = `${JSON.stringify(filters)}:${revision}`;
  const detailKey = `${selected.deliveryId}:${selected.attemptPage}:${revision}`;
  const overview = useLiveRead(overviewKey, loadOverview, !accessDenied && !retrying, denyAccess);
  const jobs = useLiveRead(listKey, loadList, !accessDenied && !retrying, denyAccess);
  const detail = useLiveRead(detailKey, loadDetail, !accessDenied && !retrying && selected.deliveryId !== null, denyAccess);
  const visibleDetail = detail.data?.id === selected.deliveryId ? detail.data : null;
  const detailCurrent = detail.dataKey === detailKey;

  const refreshAll = () => { overview.refresh(); jobs.refresh(); if (selected.deliveryId) detail.refresh(); };

  async function retry() {
    if (retrying || !visibleDetail?.canRetry || visibleDetail.status !== "FAILED") return;
    setRetrying(true);
    try {
      const result = await runServerAction(() => retryEmailDelivery(visibleDetail.id));
      if (result === undefined) return;
      if (!result.success) {
        if (result.code === "UNAUTHORIZED" || result.code === "PERMISSION_DENIED") denyAccess();
        else toast.error("ยังไม่สามารถจัดคิวใหม่ได้", { description: result.error });
        return;
      }
      toast.success("จัดคิวอีเมลเพื่อลองประมวลผลใหม่แล้ว");
      setRevision((value) => value + 1);
    } catch {
      toast.error("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setRetrying(false);
    }
  }

  if (accessDenied) return <Alert severity="error" action={<Button variant="outline" onClick={() => window.location.reload()}>โหลดหน้าใหม่</Button>}>เซสชันหมดอายุหรือไม่มีสิทธิ์ดู Email Worker กรุณาเข้าสู่ระบบด้วยบัญชี super-admin</Alert>;

  return <div className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Email Worker</h1>
        <p className="max-w-prose text-sm text-muted-foreground">ตรวจสอบคิวอีเมลแจ้งหัวหน้ายืนยันการปฏิบัติงาน สถานะ “SMTP รับแล้ว” ยังไม่ยืนยันว่าเข้ากล่องจดหมายหรืออ่านแล้ว</p>
        <p className="text-xs text-muted-foreground">รีเฟรชอัตโนมัติทุก 15 วินาทีเมื่อเปิดหน้านี้ · แสดงเวลาไทย</p>
      </div>
      <Button variant="outline" disabled={overview.loading || jobs.loading} onClick={refreshAll}><RefreshCw aria-hidden="true" className="h-4 w-4" />รีเฟรชทั้งหมด</Button>
    </div>

    {overview.error && <Alert severity="error">โหลดภาพรวมไม่สำเร็จ: {overview.error}{overview.data ? " · กำลังแสดงข้อมูลจากการโหลดครั้งล่าสุด" : ""}</Alert>}
    {overview.data ? <WorkerOverview overview={overview.data} openJob={openJob} /> : !overview.error && <div aria-label="กำลังโหลดภาพรวม" className="space-y-3"><Skeleton variant="rounded" height={120} /><Skeleton variant="rounded" height={90} /></div>}

    <section aria-labelledby="jobs-heading" className="space-y-4">
      <div><h2 id="jobs-heading" className="text-lg font-semibold">รายการงานอีเมล</h2><p className="mt-1 text-sm text-muted-foreground">หนึ่งงานต่อเอกสาร หัวหน้า และรอบคำขอยืนยัน · ช่วงวันที่อ้างอิงเวลาจัดคิว</p></div>
      <Filters key={`${search || ""}|${from || ""}|${to || ""}`} filters={filters} apply={navigate} />
      {jobs.error && <Alert severity="error">โหลดรายการไม่สำเร็จ: {jobs.error}{jobs.data ? " · รายการที่แสดงมาจากการโหลดครั้งล่าสุดและอาจไม่ตรงกับตัวกรองปัจจุบัน" : ""}</Alert>}
      <p aria-live="polite" className="text-xs text-muted-foreground">{jobs.loading ? "กำลังอัปเดตรายการ…" : jobs.data ? `${jobs.data.pagination.total.toLocaleString("th-TH")} งาน · อัปเดตเมื่อ ${displayTime(jobs.loadedAt)}` : ""}</p>
      {!jobs.data && !jobs.error && <Skeleton aria-label="กำลังโหลดรายการงาน" variant="rounded" height={180} />}
      {jobs.data && <>
        <p id="worker-jobs-scroll-hint" className="text-xs text-muted-foreground md:hidden">เลื่อนตารางแนวนอนเพื่อดูเวลาและปุ่มรายละเอียด</p>
        <TableContainer role="region" aria-label="ตารางงานอีเมล" aria-describedby="worker-jobs-scroll-hint" tabIndex={0} aria-busy={jobs.loading} className="rounded-lg border bg-card">
          <Table className="min-w-[980px]">
            <TableHead><TableRow><TableHeader>ผู้รับ / เอกสาร</TableHeader><TableHeader>สถานะ / สาเหตุ</TableHeader><TableHeader>ครั้งที่ประมวลผล</TableHeader><TableHeader>เวลา</TableHeader><TableHeader>รายละเอียด</TableHeader></TableRow></TableHead>
            <TableBody>{jobs.data.data.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center"><p className="font-medium">ไม่พบงานอีเมล</p><p className="mt-1 text-sm text-muted-foreground">เปลี่ยนตัวกรอง หรือรอเอกสารที่สร้างคำขอยืนยันใหม่</p></TableCell></TableRow> : jobs.data.data.map((job) => <TableRow key={job.id}>
              <TableCell className="max-w-80 align-top">
                <p className="break-all font-medium">{job.leaderName || "ไม่พบข้อมูลชื่อหัวหน้า"}</p>
                <p className="mt-1 break-all text-sm">{job.recipientEmail || "ไม่มีอีเมลที่บันทึกไว้"}</p>
                <p className="mt-2 text-xs text-muted-foreground">ผู้ยื่น: {job.claimantName || "ไม่พบข้อมูลผู้ยื่น"} · {displayMonth(job.expenseMonth)}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">เอกสาร: {job.expenseClaimId}</p>
                {job.contextSource !== "SNAPSHOT" && <p className="mt-1 text-xs text-muted-foreground">{job.contextSource === "CURRENT" ? "แสดงชื่อและเดือนจากข้อมูลปัจจุบัน งานเดิมไม่มีข้อมูลย้อนหลัง" : "ไม่พบข้อมูลย้อนหลังหรือข้อมูลปัจจุบัน"}</p>}
              </TableCell>
              <TableCell className="max-w-64 align-top"><Badge variant={job.status === "FAILED" ? "destructive" : "secondary"}>{deliveryLabels[job.status]}</Badge>{job.lastErrorCode && <p className="mt-2 break-words text-xs text-muted-foreground">{errorDescription(job.lastErrorCode)}</p>}</TableCell>
              <TableCell className="align-top tabular-nums"><p>{job.attemptCount} <span className="text-xs text-muted-foreground">ทั้งหมด</span></p><p className="mt-1 text-xs text-muted-foreground">รอบนี้ {job.cycleAttemptCount}</p></TableCell>
              <TableCell className="align-top text-xs"><p>จัดคิว: {displayTime(job.createdAt)}</p><p className="mt-1">อัปเดต: {displayTime(job.updatedAt)}</p>{job.nextAttemptAt && <p className="mt-1">ครั้งถัดไป: {displayTime(job.nextAttemptAt)}</p>}{job.acceptedAt && <p className="mt-1">SMTP รับ: {displayTime(job.acceptedAt)}</p>}</TableCell>
              <TableCell className="align-top"><Button size="sm" variant="outline" aria-label={`รายละเอียดงาน ${job.id}`} onClick={() => openJob(job.id)}>รายละเอียด</Button><p className="mt-2 max-w-40 break-all text-xs text-muted-foreground">{job.id}</p></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
        <PaginationControls pagination={jobs.data.pagination} onPrevious={() => navigate({ page: jobs.data!.pagination.page - 1 })} onNext={() => navigate({ page: jobs.data!.pagination.page + 1 })} />
      </>}
    </section>

    <Dialog open={selected.deliveryId !== null} onClose={closeJob} presentation="drawer" busy={retrying}>
      <DialogClose onClose={closeJob} />
      <DialogHeader><DialogTitle>รายละเอียดงานอีเมล</DialogTitle><p className="break-all text-xs text-muted-foreground">{selected.deliveryId}</p></DialogHeader>
      <DialogBody>
        {detail.error && <Alert severity="error" className="mb-4">โหลดรายละเอียดไม่สำเร็จ: {detail.error}{visibleDetail ? " · แสดงข้อมูลที่โหลดสำเร็จครั้งล่าสุด" : ""}</Alert>}
        {detail.loading && <p aria-live="polite" className="mb-3 text-xs text-muted-foreground">กำลังอัปเดตรายละเอียด…</p>}
        {visibleDetail ? <JobDetails job={visibleDetail} loading={detail.loading} setAttemptPage={(attemptPage) => navigate({ attemptPage })} /> : !detail.error && <Skeleton aria-label="กำลังโหลดรายละเอียดงาน" variant="rounded" height={220} />}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" disabled={detail.loading || retrying} onClick={detail.refresh}>รีเฟรชรายละเอียด</Button>
        {visibleDetail?.status === "FAILED" && visibleDetail.canRetry && <LoadingButton isLoading={retrying} loadingText="กำลังจัดคิว" disabled={!detailCurrent} onClick={() => void retry()}>ลองประมวลผลใหม่</LoadingButton>}
        {visibleDetail?.status === "FAILED" && !visibleDetail.canRetry && <p className="w-full text-xs text-muted-foreground">ลองใหม่ได้เมื่อคำขอยังรอยืนยันและข้อมูลผู้รับพร้อมใช้งาน</p>}
      </DialogFooter>
    </Dialog>
  </div>;
}
