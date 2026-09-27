"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, MenuItem, Skeleton, TextField } from "@mui/material";
import { RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getEmailWorkerJob, getEmailWorkerOverview, listEmailWorkerJobs, retryEmailDelivery } from "@/app/actions/email-deliveries";
import type { EmailDashboardFilter } from "@/lib/domains/email-delivery/dashboard-types";
import { runServerAction } from "@/lib/deployment/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/workflow-ui/button";
import { Input } from "@/components/workflow-ui/input";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { Dialog, DialogBody, DialogClose, DialogFooter, DialogHeader, DialogTitle } from "@/components/workflow-ui/dialog";
import { WorkerOverview } from "./overview";
import { JobDetails } from "./job-details";
import { JobList } from "./job-list";
import { deliveryLabels, displayTime } from "./presentation";
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
  return <form className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[minmax(200px,1fr)_150px_150px_150px_auto_auto]" onSubmit={(event) => {
    event.preventDefault();
    apply({ search: search.trim(), from, to, page: 1 });
  }}>
    <div className="col-span-2 min-w-0 space-y-1.5 xl:col-span-1"><Label htmlFor="worker-job-search">ค้นหางานอีเมล</Label><Input id="worker-job-search" className="min-h-11" placeholder="ชื่อ อีเมล รหัสงาน หรือเอกสาร" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={200} /></div>
    <TextField select label="สถานะงาน" size="small" className="col-span-2 xl:col-span-1 [&_.MuiInputBase-root]:min-h-11" value={filters.status || ""} onChange={(event) => apply({ status: event.target.value, page: 1 })}>
      <MenuItem value="">ทุกสถานะ</MenuItem>{Object.entries(deliveryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
    </TextField>
    <TextField type="date" label="จัดคิวตั้งแต่" className="[&_.MuiInputBase-root]:min-h-11" value={from} onChange={(event) => setFrom(event.target.value)} size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || undefined } }} />
    <TextField type="date" label="จัดคิวถึง" className="[&_.MuiInputBase-root]:min-h-11" value={to} onChange={(event) => setTo(event.target.value)} size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }} />
    <Button type="submit" className="min-h-11"><Search aria-hidden="true" />ค้นหา</Button>
    <Button variant="ghost" className="min-h-11" onClick={() => {
      setSearch(""); setFrom(""); setTo("");
      apply({ search: null, from: null, to: null, status: null, page: 1 });
    }}><X aria-hidden="true" />ล้างตัวกรอง</Button>
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
  const [filterReset, setFilterReset] = useState(0);
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
  const viewFailed = () => {
    navigate({ status: "FAILED", search: null, from: null, to: null, page: 1 });
    setFilterReset((value) => value + 1);
  };

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

  if (accessDenied) return <Alert severity="error" action={<Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>โหลดหน้าใหม่</Button>}>เซสชันหมดอายุหรือไม่มีสิทธิ์ดู Email Worker กรุณาเข้าสู่ระบบด้วยบัญชี super-admin</Alert>;

  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1"><h1 className="text-xl font-semibold">Email Worker</h1><p className="text-sm text-muted-foreground">ตรวจสอบงานแจ้งหัวหน้ายืนยันการปฏิบัติงาน</p></div>
        <p className="text-xs text-muted-foreground">รีเฟรชทุก 15 วินาทีเมื่อเปิดหน้านี้ · เวลาไทย{jobs.loadedAt ? ` · อัปเดตรายการ ${displayTime(jobs.loadedAt)}` : ""}</p>
        {(overview.error || jobs.error) && <p className="text-xs font-medium text-destructive">โหลดข้อมูลล่าสุดไม่สำเร็จ ข้อมูลที่แสดงอาจเก่า</p>}
      </div>
      <Button variant="outline" className="min-h-11" disabled={overview.loading || jobs.loading || retrying} onClick={refreshAll}><RefreshCw aria-hidden="true" />รีเฟรชทั้งหมด</Button>
    </div>

    {overview.error && <Alert severity="error">โหลดภาพรวมไม่สำเร็จ: {overview.error}{overview.data ? " · กำลังแสดงข้อมูลจากการโหลดครั้งล่าสุด" : ""}</Alert>}
    {overview.data ? <WorkerOverview overview={overview.data} openJob={openJob} onViewFailed={viewFailed} /> : !overview.error && <div aria-label="กำลังโหลดภาพรวม" className="space-y-3"><Skeleton variant="rounded" height={100} /><Skeleton variant="rounded" height={70} /></div>}

    <section aria-labelledby="jobs-heading" className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h2 id="jobs-heading" className="text-lg font-semibold">รายการงานอีเมล</h2><p className="text-xs text-muted-foreground">ช่วงวันที่อ้างอิงเวลาจัดคิว · อีเมลที่แสดงคืออีเมลล่าสุดที่บันทึกในงาน</p></div>
      <Filters key={`${search || ""}|${from || ""}|${to || ""}|${filterReset}`} filters={filters} apply={navigate} />
      {jobs.error && <Alert severity="error">โหลดรายการไม่สำเร็จ: {jobs.error}{jobs.data ? " · รายการที่แสดงมาจากการโหลดครั้งล่าสุดและอาจไม่ตรงกับตัวกรองปัจจุบัน" : ""}</Alert>}
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">{jobs.data ? `${jobs.data.pagination.total.toLocaleString("th-TH")} งาน` : ""}{jobs.loading ? " · กำลังอัปเดตรายการ…" : ""}</p>
      {!jobs.data && !jobs.error && <Skeleton aria-label="กำลังโหลดรายการงาน" variant="rounded" height={180} />}
      {jobs.data && <>
        <JobList jobs={jobs.data.data} loading={jobs.loading} openJob={openJob} />
        <p className="text-xs text-muted-foreground">“SMTP รับแล้ว” ยังไม่ยืนยันว่าเข้ากล่องจดหมายหรืออ่านแล้ว · จำนวนครั้งรวมการประมวลผลที่ไม่ถึงขั้นส่ง SMTP</p>
        <div className="[&_button]:min-h-11 [&_button]:min-w-11"><PaginationControls pagination={jobs.data.pagination} onPrevious={() => navigate({ page: jobs.data!.pagination.page - 1 })} onNext={() => navigate({ page: jobs.data!.pagination.page + 1 })} /></div>
      </>}
    </section>

    <Dialog open={selected.deliveryId !== null} onClose={closeJob} presentation="drawer" busy={retrying} className="[&_button]:min-h-11 [&_button]:min-w-11">
      <DialogClose onClose={closeJob} />
      <DialogHeader><DialogTitle>รายละเอียดงานอีเมล</DialogTitle><p className="break-all text-xs text-muted-foreground">{selected.deliveryId}</p></DialogHeader>
      <DialogBody>
        {detail.error && <Alert severity="error" className="mb-4">โหลดรายละเอียดไม่สำเร็จ: {detail.error}{visibleDetail ? " · แสดงข้อมูลที่โหลดสำเร็จครั้งล่าสุด" : ""}</Alert>}
        {detail.loading && <p aria-live="polite" className="mb-3 text-xs text-muted-foreground">กำลังอัปเดตรายละเอียด…</p>}
        {visibleDetail ? <JobDetails job={visibleDetail} loading={detail.loading} setAttemptPage={(attemptPage) => navigate({ attemptPage })} /> : !detail.error && <Skeleton aria-label="กำลังโหลดรายละเอียดงาน" variant="rounded" height={220} />}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" className="min-h-11" disabled={detail.loading || retrying} onClick={detail.refresh}><RefreshCw aria-hidden="true" />รีเฟรชรายละเอียด</Button>
        {visibleDetail?.status === "FAILED" && visibleDetail.canRetry && <LoadingButton isLoading={retrying} loadingText="กำลังจัดคิว" disabled={!detailCurrent} onClick={() => void retry()}>ลองประมวลผลใหม่</LoadingButton>}
        {visibleDetail?.status === "FAILED" && !visibleDetail.canRetry && <p className="w-full text-xs text-muted-foreground">ลองใหม่ได้เมื่อคำขอยังรอยืนยันและข้อมูลผู้รับพร้อมใช้งาน</p>}
      </DialogFooter>
    </Dialog>
  </div>;
}
