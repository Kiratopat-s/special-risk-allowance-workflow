import type { EmailDeliveryDetail } from "@/lib/domains/email-delivery/dashboard-types";
import type { EmailContextSnapshot } from "@/lib/domains/email-delivery/snapshots";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { attemptLabels, deliveryLabels, displayMonth, displayTime, errorDescription } from "./presentation";

const orderLabels = { PENDING: "รอยืนยัน", VERIFIED: "ยืนยันแล้ว", EXPIRED: "หมดอายุ", UNLINKED: "ถอดจากเอกสารแล้ว", DELETED: "ใบสั่งถูกลบแล้ว", MISSING: "ไม่มีข้อมูลของคำขอเดิม" };
const eligibilityLabels = { queued: "บันทึกเข้าคิว", eligible: "พร้อมประมวลผล", skipped: "ข้ามการส่ง", failed: "ข้อมูลยังไม่พร้อม" };

function ContextDetails({ context }: { context: EmailContextSnapshot }) {
  return <div className="space-y-3 text-sm">
    <p className="text-xs text-muted-foreground">บันทึกเมื่อ {displayTime(context.capturedAt)}</p>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[
        ["ผู้ยื่น", context.claimantName || "ไม่พบข้อมูลผู้ยื่น"],
        ["เดือนที่เบิก", displayMonth(context.expenseMonth)],
        ["หัวหน้าผู้รับ", context.leaderName || "ไม่พบข้อมูลชื่อหัวหน้า"],
        ["อีเมลผู้รับ", context.recipientEmail || "ไม่มีอีเมล"],
        ["สถานะเอกสาร", context.claimStatus || "ไม่พบข้อมูลเอกสาร"],
        ["สถานะบัญชีผู้รับ", context.recipientStatus || "ไม่พบข้อมูลบัญชี"],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}
    </dl>
    <p>{eligibilityLabels[context.eligibility.kind]}{context.eligibility.code ? ` · ${errorDescription(context.eligibility.code)}` : ""}</p>
    <div>
      <h4 className="font-medium">ใบสั่งและคำขอยืนยัน ({context.orders.length})</h4>
      {context.orders.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">ไม่มีรายละเอียดคำขอยืนยันที่บันทึกไว้</p> : <ul className="mt-2 divide-y rounded-md border px-3">
        {context.orders.map((order) => <li key={order.verificationId} className="space-y-1 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-all font-medium">{order.reference || "ไม่มีเลขที่ใบสั่ง"}</p><Badge variant="outline">{orderLabels[order.state]}</Badge></div>
          <p className="break-all text-xs text-muted-foreground">คำขอยืนยัน: {order.verificationId}</p>
          {order.offSiteWorkId && <p className="break-all text-xs text-muted-foreground">ใบสั่ง: {order.offSiteWorkId}</p>}
          <p className="text-xs text-muted-foreground">หมดอายุ: {displayTime(order.expiresAt)}</p>
        </li>)}
      </ul>}
    </div>
  </div>;
}

export function JobDetails({ job, loading, setAttemptPage }: {
  job: EmailDeliveryDetail; loading: boolean; setAttemptPage: (page: number) => void;
}) {
  return <div className="space-y-6">
    <section className="space-y-3" aria-label="สถานะงานอีเมล">
      <Badge variant={job.status === "FAILED" ? "destructive" : "secondary"}>{deliveryLabels[job.status]}</Badge>
      <p className="break-all text-sm">เอกสาร: {job.expenseClaimId}</p>
      <p className="break-all text-sm">หัวหน้า: {job.leaderName || job.leaderUserId}</p>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {[
          ["จำนวนครั้งที่ประมวลผลทั้งหมด", String(job.attemptCount)], ["จำนวนครั้งในรอบปัจจุบัน", String(job.cycleAttemptCount)],
          ["จัดคิว", displayTime(job.createdAt)], ["อัปเดตงาน", displayTime(job.updatedAt)],
          ["ลองครั้งถัดไป", displayTime(job.nextAttemptAt)], ["หมดเวลาจองงาน", displayTime(job.leaseExpiresAt)],
          ["SMTP รับเมื่อ", displayTime(job.acceptedAt)], ["อีเมลล่าสุดที่บันทึกในงาน", job.recipientEmail || "ไม่มีอีเมล"],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground">จำนวนครั้งรวมการตรวจข้อมูลและการประมวลผลที่ไม่ถึงขั้นส่ง SMTP</p>
      {job.lastErrorCode && <p className="text-sm">{errorDescription(job.lastErrorCode)}</p>}
      {job.messageId && <p className="break-all text-xs">Message-ID: {job.messageId}</p>}
      <details className="text-xs"><summary className="cursor-pointer py-1 text-primary">รหัสคำขอยืนยันในงาน ({job.verificationIds.length})</summary><ul className="mt-1 space-y-1">{job.verificationIds.map((id) => <li key={id} className="break-all">{id}</li>)}</ul></details>
    </section>

    <section className="space-y-3 border-t pt-5" aria-labelledby="queued-context-heading">
      <h3 id="queued-context-heading" className="font-semibold">ข้อมูลที่บันทึกเมื่อเข้าคิว</h3>
      {job.contextSnapshot ? <details><summary className="cursor-pointer py-1 text-sm text-primary">เปิดข้อมูลผู้รับและใบสั่งเมื่อเข้าคิว</summary><div className="mt-3"><ContextDetails context={job.contextSnapshot} /></div></details> : <p className="text-sm text-muted-foreground">งานเดิมนี้ไม่มีข้อมูลย้อนหลังที่บันทึกไว้ ข้อมูลปัจจุบันด้านล่างอาจต่างจากตอนสร้างงาน</p>}
    </section>

    <section className="space-y-3 border-t pt-5" aria-labelledby="current-context-heading">
      <h3 id="current-context-heading" className="font-semibold">ข้อมูลปัจจุบัน</h3>
      <p className="text-xs text-muted-foreground">ใช้ตรวจความพร้อมสำหรับการประมวลผลครั้งถัดไป ข้อมูลนี้ไม่ใช่สำเนาอีเมลที่ส่งไปแล้ว</p>
      <details><summary className="cursor-pointer py-1 text-sm text-primary">เปิดข้อมูลผู้รับและใบสั่งปัจจุบัน</summary><div className="mt-3"><ContextDetails context={job.currentContext} /></div></details>
    </section>

    <section className="space-y-3 border-t pt-5" aria-labelledby="attempts-heading">
      <h3 id="attempts-heading" className="font-semibold">ประวัติการประมวลผลและจัดคิว ({job.attempts.pagination.total})</h3>
      <p className="text-xs text-muted-foreground">แสดงครั้งละ 25 รายการ เหตุการณ์ผู้ดูแลจัดคิวใหม่ไม่นับเป็นการประมวลผลเพิ่ม</p>
      {job.attempts.data.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการประมวลผล</p> : <ol className="divide-y rounded-lg border px-4">
        {job.attempts.data.map((attempt) => <li key={attempt.id} className="space-y-2 py-4 text-sm">
          <p className="font-medium">{attempt.outcome === "MANUAL_RETRY" ? "ผู้ดูแลจัดคิวใหม่" : `ประมวลผลครั้งที่ ${attempt.attemptNumber} · ${attemptLabels[attempt.outcome || ""] || "อยู่ระหว่างประมวลผล"}`}</p>
          <p className="break-all">ผู้รับที่ใช้ในครั้งนี้: {attempt.recipientEmail || "ยังไม่มีการบันทึกผู้รับ"}</p>
          <p className="text-xs text-muted-foreground">เริ่ม: {displayTime(attempt.startedAt)}<br />สิ้นสุด: {displayTime(attempt.finishedAt)}</p>
          {attempt.errorCode && <p className="text-xs">{errorDescription(attempt.errorCode)}</p>}
          {attempt.workerRunId && <p className="break-all text-xs text-muted-foreground">รอบ worker: {attempt.workerRunId}</p>}
          {attempt.messageId && <p className="break-all text-xs">Message-ID: {attempt.messageId}</p>}
          {attempt.requestedById && <p className="break-all text-xs">ผู้สั่งลองใหม่: {attempt.requestedByName || attempt.requestedById}</p>}
          {attempt.contextSnapshot ? <details><summary className="cursor-pointer py-1 text-primary">ข้อมูลก่อนประมวลผลครั้งนี้</summary><div className="mt-2"><ContextDetails context={attempt.contextSnapshot} /></div></details> : <p className="text-xs text-muted-foreground">ไม่มีข้อมูลบริบทที่บันทึกไว้สำหรับเหตุการณ์นี้</p>}
        </li>)}
      </ol>}
      <PaginationControls pagination={job.attempts.pagination} isPending={loading} onPrevious={() => setAttemptPage(job.attempts.pagination.page - 1)} onNext={() => setAttemptPage(job.attempts.pagination.page + 1)} />
    </section>
  </div>;
}
