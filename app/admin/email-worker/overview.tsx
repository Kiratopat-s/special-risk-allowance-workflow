import { ArrowRight, ChevronDown, TriangleAlert } from "lucide-react";
import type { EmailWorkerOverview, EmailWorkerRunView } from "@/lib/domains/email-delivery/dashboard-types";
import { Button } from "@/components/workflow-ui/button";
import { displayTime, errorMessage, readyAge, safeCode } from "./presentation";
import { WorkerStatusBadge } from "./status-indicator";

export function WorkerOverview({ overview, openJob, onViewFailed }: {
  overview: EmailWorkerOverview;
  openJob: (id: string) => void;
  onViewFailed: () => void;
}) {
  const liveWorkers = overview.workers.filter((worker) => !["STOPPED", "NO_SIGNAL"].includes(worker.state));
  const currentWorkers = liveWorkers.length ? liveWorkers : overview.workers.slice(0, 1);
  const currentIds = new Set(currentWorkers.map((worker) => worker.id));
  const previousWorkers = overview.workers.filter((worker) => !currentIds.has(worker.id));
  const problemWorkers = currentWorkers.filter((worker) => ["DEGRADED", "STALLED", "NO_SIGNAL"].includes(worker.state));
  const counts = [
    ["ถึงเวลาประมวลผล", overview.readyCount],
    ["กำลังประมวลผล", overview.processingCount],
    ["รอถึงเวลาลองใหม่", overview.retryWaitCount],
    ["ล้มเหลว", overview.failedCount],
    ["SMTP รับแล้วใน 24 ชม.", overview.acceptedLast24HoursCount],
  ] as const;
  return (
    <section aria-labelledby="worker-overview-heading" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-y">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <h2 id="worker-overview-heading" className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ที่ต้องตรวจสอบ
          </h2>
          <p className={overview.failedCount ? "text-destructive" : "text-muted-foreground"}>งานล้มเหลว <strong className="tabular-nums">{overview.failedCount.toLocaleString("th-TH")}</strong></p>
          <p className={overview.expiredLeaseCount ? "text-destructive" : "text-muted-foreground"}>หมดเวลาจอง <strong className="tabular-nums">{overview.expiredLeaseCount.toLocaleString("th-TH")}</strong></p>
          {problemWorkers.length > 0 && <p className="text-destructive">worker ที่มีปัญหา <strong className="tabular-nums">{problemWorkers.length.toLocaleString("th-TH")}</strong></p>}
        </div>
        <Button variant="link" className="min-h-11 gap-2 px-0" onClick={onViewFailed}>
          ดูงานล้มเหลวทั้งหมด <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <p>ข้อมูลทั้งระบบ ไม่เปลี่ยนตามตัวกรองรายการงาน · worker ที่มีสัญญาณล่าสุด {overview.activeWorkerCount}</p>
          <p className="tabular-nums">ตรวจเมื่อ {displayTime(overview.measuredAt)}</p>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 lg:grid-cols-5">
          {counts.map(([label, count]) => <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={`whitespace-nowrap text-lg font-semibold tabular-nums ${label === "ล้มเหลว" && count > 0 ? "text-destructive" : ""}`}>
              {count.toLocaleString("th-TH")} <span className="text-xs font-normal text-muted-foreground">งาน</span>
            </dd>
          </div>)}
        </dl>
        <p className="mt-1 text-xs text-muted-foreground">
          งานถึงกำหนดที่รอนานที่สุด: <span className="font-medium text-foreground">{readyAge(overview.oldestReadyAt, overview.measuredAt)}</span>
          {overview.oldestReadyAt && <span> · ตั้งแต่ {displayTime(overview.oldestReadyAt)}</span>}
          <span className="mt-1 block sm:ml-3 sm:mt-0 sm:inline">จำนวนกำลังประมวลผลรวมงานที่หมดเวลาจองแล้ว</span>
        </p>
      </div>

      <div className="border-y">
        {overview.workers.length === 0 ? <div className="py-2 text-sm">
          <p className="font-medium">ยังไม่เคยพบ worker</p>
          <p className="mt-1 max-w-prose text-muted-foreground">ตรวจสอบ deployment และ container logs ข้อผิดพลาดก่อนเชื่อมต่อฐานข้อมูลจะยังไม่ปรากฏในหน้านี้</p>
        </div> : <>
          <WorkerRuns workers={currentWorkers} openJob={openJob} label="รอบการทำงานของ worker" />
          {previousWorkers.length > 0 && <details className="mt-1 border-t">
            <summary className="min-h-11 cursor-pointer py-3 text-xs text-muted-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">รอบ worker ก่อนหน้า ({previousWorkers.length})</summary>
            <WorkerRuns workers={previousWorkers} openJob={openJob} label="รอบ worker ก่อนหน้า" historical />
          </details>}
        </>}
      </div>
    </section>
  );
}

function WorkerRuns({ workers, openJob, label, historical = false }: {
  workers: EmailWorkerRunView[];
  openJob: (id: string) => void;
  label: string;
  historical?: boolean;
}) {
  return <div role="region" aria-label={label} className="divide-y">
    {workers.map((worker, index) => <div key={worker.id} className="py-1">
      <div className="flex min-w-0 flex-col gap-x-4 gap-y-1 lg:flex-row lg:items-start">
        <details className="group min-w-0 flex-1 text-xs">
          <summary className="grid min-h-11 cursor-pointer list-none grid-cols-2 items-center gap-x-5 gap-y-2 py-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring lg:grid-cols-[minmax(130px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="mb-1 block font-medium">worker{workers.length > 1 ? ` ${index + 1}` : ""}</span>
              <WorkerStatusBadge state={worker.state} />
            </span>
            <span>
              <span className="block text-muted-foreground">สัญญาณล่าสุด</span>
              <span className="mt-1 block tabular-nums">{displayTime(worker.lastHeartbeatAt)}</span>
            </span>
            <span>
              <span className="block text-muted-foreground">ประมวลผลคิวล่าสุด</span>
              <span className="mt-1 block tabular-nums">{displayTime(worker.lastProgressAt)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden="true" />
              <span>รายละเอียด instance</span>
            </span>
          </summary>
          <dl className="mt-2 grid gap-x-6 gap-y-3 pb-3 sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-muted-foreground">Instance ID</dt><dd className="mt-1 break-all">{worker.id}</dd></div>
            <div><dt className="text-muted-foreground">เริ่มทำงาน</dt><dd className="mt-1 tabular-nums">{displayTime(worker.startedAt)}</dd></div>
            {worker.currentDeliveryId && <div className="min-w-0"><dt className="text-muted-foreground">รหัสงานปัจจุบัน</dt><dd className="mt-1 break-all">{worker.currentDeliveryId}</dd></div>}
            {worker.stoppingAt && <div><dt className="text-muted-foreground">เริ่มหยุด</dt><dd className="mt-1 tabular-nums">{displayTime(worker.stoppingAt)}</dd></div>}
            {worker.stoppedAt && <div><dt className="text-muted-foreground">หยุดแล้ว</dt><dd className="mt-1 tabular-nums">{displayTime(worker.stoppedAt)}</dd></div>}
            {worker.lastErrorCode && <div className="min-w-0 sm:col-span-2">
              <dt className="text-muted-foreground">ข้อผิดพลาดที่บันทึกล่าสุด{worker.state !== "DEGRADED" ? " (ข้อมูลย้อนหลัง)" : ""}</dt>
              <dd className="mt-1">{errorMessage(worker.lastErrorCode)}<span className="mt-1 block break-all text-muted-foreground">{safeCode(worker.lastErrorCode) ?? "UNKNOWN_ERROR"} · {displayTime(worker.lastErrorAt)}</span></dd>
            </div>}
          </dl>
        </details>
        {worker.currentDeliveryId ? <Button variant="link" className="min-h-11 max-w-full gap-1.5 self-start px-0 text-left lg:mt-1" onClick={() => openJob(worker.currentDeliveryId!)}>
          <span className="truncate">งาน {worker.currentDeliveryId.slice(0, 12)}</span><ArrowRight className="size-4" aria-hidden="true" />
        </Button> : <p className="text-xs text-muted-foreground lg:mt-5">ไม่มีงานปัจจุบัน</p>}
      </div>
      {!historical && worker.state === "DEGRADED" && worker.lastErrorCode && <p className="mt-1 pb-1 text-sm text-destructive">{errorMessage(worker.lastErrorCode)}</p>}
    </div>)}
  </div>;
}
