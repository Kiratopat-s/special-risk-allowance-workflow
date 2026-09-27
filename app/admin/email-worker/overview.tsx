import type { EmailWorkerOverview, EmailWorkerRunView } from "@/lib/domains/email-delivery/dashboard-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/workflow-ui/button";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/workflow-ui/table";
import { displayTime, errorDescription, readyAge, workerLabels } from "./presentation";

export function WorkerOverview({ overview, openJob }: { overview: EmailWorkerOverview; openJob: (id: string) => void }) {
  const liveWorkers = overview.workers.filter((worker) => !["STOPPED", "NO_SIGNAL"].includes(worker.state));
  const currentWorkers = liveWorkers.length ? liveWorkers : overview.workers.slice(0, 1);
  const currentIds = new Set(currentWorkers.map((worker) => worker.id));
  const previousWorkers = overview.workers.filter((worker) => !currentIds.has(worker.id));
  const counts = [
    ["งานถึงเวลาประมวลผล", overview.readyCount],
    ["สถานะกำลังประมวลผล", overview.processingCount],
    ["รอถึงเวลาลองใหม่", overview.retryWaitCount],
    ["ล้มเหลว", overview.failedCount],
    ["SMTP รับแล้วใน 24 ชั่วโมง", overview.acceptedLast24HoursCount],
    ["งานที่หมดเวลาจอง", overview.expiredLeaseCount],
  ] as const;
  return (
    <section aria-labelledby="worker-overview-heading" className="space-y-4">
      <div>
        <h2 id="worker-overview-heading" className="text-lg font-semibold">ภาพรวมคิวและ worker</h2>
        <p className="mt-1 text-sm text-muted-foreground">ข้อมูลทั้งระบบ ไม่เปลี่ยนตามตัวกรองรายการงาน · ตรวจเมื่อ {displayTime(overview.measuredAt)}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
        {counts.map(([label, count]) => <div key={label} className="space-y-1">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-xl font-semibold tabular-nums">{count.toLocaleString("th-TH")} <span className="text-xs font-normal text-muted-foreground">งาน</span></dd>
        </div>)}
      </dl>
      <p className="text-xs text-muted-foreground">สถานะกำลังประมวลผลรวมงานที่หมดเวลาจองแล้ว จึงไม่ใช่จำนวนงานที่กำลังส่ง SMTP จริง</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <p>worker ที่มีสัญญาณล่าสุด: <strong className="font-semibold text-foreground">{overview.activeWorkerCount}</strong></p>
        <p>งานที่ถึงกำหนดและรอนานที่สุด: {readyAge(overview.oldestReadyAt, overview.measuredAt)}{overview.oldestReadyAt && ` · ตั้งแต่ ${displayTime(overview.oldestReadyAt)}`}</p>
      </div>
      {overview.workers.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">ยังไม่มีข้อมูล worker ให้ตรวจสอบบริการและบันทึก deployment หรือ container ข้อผิดพลาดก่อนเชื่อมต่อฐานข้อมูลอาจยังไม่ปรากฏในหน้านี้</p> : (
        <div className="space-y-3">
          <WorkerRuns workers={currentWorkers} openJob={openJob} label="รอบการทำงานของ worker" />
          {previousWorkers.length > 0 && <details className="rounded-lg border bg-card p-3">
            <summary className="cursor-pointer text-sm text-primary">รอบ worker ก่อนหน้า ({previousWorkers.length})</summary>
            <div className="mt-3"><WorkerRuns workers={previousWorkers} openJob={openJob} label="รอบ worker ก่อนหน้า" /></div>
          </details>}
        </div>
      )}
    </section>
  );
}

function WorkerRuns({ workers, openJob, label }: { workers: EmailWorkerRunView[]; openJob: (id: string) => void; label: string }) {
  return (
        <TableContainer role="region" aria-label={label} tabIndex={0} className="rounded-lg border bg-card">
          <Table className="min-w-[780px]">
            <TableHead><TableRow><TableHeader>รอบ worker / สถานะ</TableHeader><TableHeader>สัญญาณและการทำงานล่าสุด</TableHeader><TableHeader>งานปัจจุบัน / ข้อผิดพลาด</TableHeader></TableRow></TableHead>
            <TableBody>{workers.map((worker) => <TableRow key={worker.id}>
              <TableCell className="max-w-72 align-top">
                <Badge variant={["DEGRADED", "STALLED", "NO_SIGNAL"].includes(worker.state) ? "destructive" : "secondary"}>{workerLabels[worker.state] || "ไม่ทราบสถานะ"}</Badge>
                <p className="mt-2 break-all text-xs">{worker.id}</p>
                <p className="mt-1 text-xs text-muted-foreground">เริ่ม: {displayTime(worker.startedAt)}</p>
                {worker.stoppingAt && <p className="mt-1 text-xs text-muted-foreground">เริ่มหยุด: {displayTime(worker.stoppingAt)}</p>}
                {worker.stoppedAt && <p className="mt-1 text-xs text-muted-foreground">หยุด: {displayTime(worker.stoppedAt)}</p>}
              </TableCell>
              <TableCell className="align-top text-xs">
                <p>สัญญาณ: {displayTime(worker.lastHeartbeatAt)}</p>
                <p className="mt-1">ประมวลผลคิว: {displayTime(worker.lastProgressAt)}</p>
              </TableCell>
              <TableCell className="max-w-80 align-top text-xs">
                {worker.currentDeliveryId ? <Button variant="link" size="sm" className="h-auto break-all px-0 text-left" onClick={() => openJob(worker.currentDeliveryId!)}>{worker.currentDeliveryId}</Button> : <p className="text-muted-foreground">ไม่มีงานปัจจุบัน</p>}
                {worker.lastErrorCode && <p className="mt-2">{errorDescription(worker.lastErrorCode)}<br />เมื่อ {displayTime(worker.lastErrorAt)}</p>}
              </TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
  );
}
