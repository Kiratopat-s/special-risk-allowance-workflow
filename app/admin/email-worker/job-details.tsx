import { useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { EmailDeliveryDetail } from "@/lib/domains/email-delivery/dashboard-types";
import type { EmailContextSnapshot } from "@/lib/domains/email-delivery/snapshots";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { CopyIdentifier } from "./copy-identifier";
import { AttemptStatusBadge, DeliveryStatusBadge } from "./status-indicator";
import { displayMonth, displayTime, errorMessage, safeCode } from "./presentation";

const orderLabels = { PENDING: "รอยืนยัน", VERIFIED: "ยืนยันแล้ว", EXPIRED: "หมดอายุ", UNLINKED: "ถอดจากเอกสารแล้ว", DELETED: "ใบสั่งถูกลบแล้ว", MISSING: "ไม่มีข้อมูลของคำขอเดิม" };
const eligibilityLabels = { queued: "บันทึกเข้าคิว", eligible: "พร้อมประมวลผล", skipped: "ข้ามการส่ง", failed: "ข้อมูลยังไม่พร้อม" };

function Disclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <details className="group/disclosure min-w-0">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <span className="min-w-0">{title}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open/disclosure:rotate-180" />
    </summary>
    <div className="min-w-0 space-y-4 pb-4 pt-1">{children}</div>
  </details>;
}

function Field({ label, children, email = false }: { label: string; children: ReactNode; email?: boolean }) {
  return <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className={`mt-1 text-sm tabular-nums${email ? " [overflow-wrap:anywhere]" : ""}`}>{children}</dd>
  </div>;
}

function ContextDetails({ context }: { context: EmailContextSnapshot }) {
  return <div className="min-w-0 space-y-4 text-sm">
    <p className="text-xs tabular-nums text-muted-foreground">บันทึกเมื่อ {displayTime(context.capturedAt)}</p>
    <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
      <Field label="ผู้ยื่น">{context.claimantName || "ไม่พบข้อมูลผู้ยื่น"}</Field>
      <Field label="เดือนที่เบิก">{displayMonth(context.expenseMonth)}</Field>
      <Field label="หัวหน้าผู้รับ">{context.leaderName || "ไม่พบข้อมูลชื่อหัวหน้า"}</Field>
      <Field label="อีเมลผู้รับ" email>{context.recipientEmail || "ไม่มีอีเมล"}</Field>
      <Field label="สถานะเอกสาร">{context.claimStatus || "ไม่พบข้อมูลเอกสาร"}</Field>
      <Field label="สถานะบัญชีผู้รับ">{context.recipientStatus || "ไม่พบข้อมูลบัญชี"}</Field>
    </dl>
    <p>{eligibilityLabels[context.eligibility.kind]}{context.eligibility.code ? ` · ${errorMessage(context.eligibility.code)}` : ""}</p>
    <div>
      <h4 className="font-medium">ใบสั่งและคำขอยืนยัน ({context.orders.length})</h4>
      {context.orders.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">ไม่มีรายละเอียดคำขอยืนยันที่บันทึกไว้</p> : <ul className="mt-1 divide-y">
        {context.orders.map((order) => <li key={order.verificationId} className="space-y-2 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{order.reference || "ไม่มีเลขที่ใบสั่ง"}</p>
            <Badge variant="outline">{orderLabels[order.state]}</Badge>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">หมดอายุ: {displayTime(order.expiresAt)}</p>
          <p className="break-all text-xs text-muted-foreground">คำขอยืนยัน: {order.verificationId}</p>
          {order.offSiteWorkId && <p className="break-all text-xs text-muted-foreground">ใบสั่ง: {order.offSiteWorkId}</p>}
        </li>)}
      </ul>}
    </div>
  </div>;
}

export function JobDetails({ job, loading, setAttemptPage }: {
  job: EmailDeliveryDetail; loading: boolean; setAttemptPage: (page: number) => void;
}) {
  const errorCode = safeCode(job.lastErrorCode);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const changeAttemptPage = (page: number) => {
    historyHeading.current?.focus({ preventScroll: true });
    setAttemptPage(page);
  };

  return <div className="min-w-0 space-y-6">
    <section className="space-y-4" aria-label="สถานะงานอีเมล">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{job.leaderName || "ไม่พบข้อมูลชื่อหัวหน้า"}</p>
          <p className="mt-1 text-sm [overflow-wrap:anywhere]">{job.recipientEmail || "ยังไม่มีอีเมลที่บันทึกในงาน"}</p>
          <p className="mt-1 text-xs text-muted-foreground">อีเมลล่าสุดที่บันทึกในงาน</p>
        </div>
        <DeliveryStatusBadge status={job.status} />
      </div>
      {job.lastErrorCode && <p className="text-sm">{errorMessage(job.lastErrorCode)}</p>}
      {job.status === "ACCEPTED" && <p className="text-xs text-muted-foreground">SMTP รับอีเมลแล้ว ยังไม่ยืนยันว่าเข้ากล่องจดหมายหรือถูกอ่าน</p>}
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Field label="ผู้ยื่น">{job.claimantName || "ไม่พบข้อมูลผู้ยื่น"}</Field>
        <Field label="เดือนที่เบิก">{displayMonth(job.expenseMonth)}</Field>
        <Field label="จำนวนครั้งที่ประมวลผลทั้งหมด">{job.attemptCount}</Field>
        <Field label="จำนวนครั้งในรอบปัจจุบัน">{job.cycleAttemptCount}</Field>
        <Field label={job.status === "PENDING" ? "กำหนดประมวลผล" : "ลองครั้งถัดไป"}>
          {job.status === "PENDING" || job.status === "RETRY_WAIT" ? displayTime(job.nextAttemptAt) : "—"}
        </Field>
        {job.status === "ACCEPTED" && <Field label="SMTP รับเมื่อ">{displayTime(job.acceptedAt)}</Field>}
      </dl>
      <p className="text-xs text-muted-foreground">จำนวนครั้งรวมการตรวจข้อมูลและการประมวลผลที่ไม่ถึงขั้นส่ง SMTP</p>
      {!job.contextSnapshot && <div className="space-y-1 text-xs text-muted-foreground">
        <p>ไม่ได้บันทึกรายละเอียดในขณะนั้น</p>
        <p>{job.contextSource === "CURRENT" ? "ชื่อและเดือนด้านบนเป็นข้อมูลปัจจุบัน ซึ่งอาจต่างจากตอนสร้างงาน" : "ไม่พบชื่อและเดือนที่บันทึกไว้ในงานนี้"}</p>
      </div>}
    </section>

    <section className="space-y-3 border-t pt-5" aria-labelledby="attempts-heading">
      <h3 ref={historyHeading} id="attempts-heading" tabIndex={-1} className="font-semibold">ประวัติการประมวลผลและจัดคิว ({job.attempts.pagination.total})</h3>
      <p className="text-xs text-muted-foreground">แสดงครั้งละ 25 รายการ เหตุการณ์ผู้ดูแลจัดคิวใหม่ไม่นับเป็นการประมวลผลเพิ่ม</p>
      {job.attempts.data.length === 0 ? <p className="py-2 text-sm text-muted-foreground">ยังไม่มีประวัติการประมวลผล</p> : <ol className="divide-y">
        {job.attempts.data.map((attempt) => {
          const manualRetry = attempt.outcome === "MANUAL_RETRY";
          const attemptErrorCode = safeCode(attempt.errorCode);
          return <li key={attempt.id} className="min-w-0 space-y-3 py-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!manualRetry && <h4 className="font-medium tabular-nums">ประมวลผลครั้งที่ {attempt.attemptNumber}</h4>}
              <AttemptStatusBadge outcome={attempt.outcome} />
            </div>
            <p className="[overflow-wrap:anywhere]">{manualRetry ? "อีเมลที่บันทึกขณะจัดคิวใหม่" : "ผู้รับที่ใช้ในครั้งนี้"}: {attempt.recipientEmail || "ยังไม่มีการบันทึกผู้รับ"}</p>
            {attempt.errorCode && <p>{errorMessage(attempt.errorCode)}</p>}
            <dl className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
              <Field label={manualRetry ? "จัดคิวเมื่อ" : "เริ่ม"}>{displayTime(attempt.startedAt)}</Field>
              {!manualRetry && <Field label="สิ้นสุด">{displayTime(attempt.finishedAt)}</Field>}
            </dl>
            {attempt.requestedById && <p className="text-xs [overflow-wrap:anywhere]">ผู้สั่งลองใหม่: {attempt.requestedByName || attempt.requestedById}</p>}
            <Disclosure title={manualRetry ? "ข้อมูลขณะจัดคิวใหม่" : "ข้อมูลก่อนประมวลผลครั้งนี้"}>
              {attempt.contextSnapshot ? <ContextDetails context={attempt.contextSnapshot} /> : <p className="text-sm text-muted-foreground">ไม่ได้บันทึกรายละเอียดในขณะนั้น</p>}
              <dl className="space-y-3 border-t pt-3">
                <Field label="รหัสเหตุการณ์"><CopyIdentifier value={attempt.id} label="รหัสเหตุการณ์" /></Field>
                {attemptErrorCode && <Field label="รหัสข้อผิดพลาด"><code className="break-all text-xs">{attemptErrorCode}</code></Field>}
                {attempt.workerRunId && <Field label="รอบ worker"><CopyIdentifier value={attempt.workerRunId} label="รอบ worker" /></Field>}
                {attempt.messageId && <Field label="Message-ID"><CopyIdentifier value={attempt.messageId} label="Message-ID ของครั้งนี้" /></Field>}
              </dl>
            </Disclosure>
          </li>;
        })}
      </ol>}
      <div className="[&_button]:min-h-11 [&_button]:min-w-11 [&_section]:flex-wrap [&_section]:gap-3 [&_section]:rounded-none [&_section]:border-0 [&_section]:px-0">
        <PaginationControls pagination={job.attempts.pagination} isPending={loading} onPrevious={() => changeAttemptPage(job.attempts.pagination.page - 1)} onNext={() => changeAttemptPage(job.attempts.pagination.page + 1)} />
      </div>
    </section>

    <div className="divide-y border-y">
      <Disclosure title={<><span className="block">ข้อมูลที่บันทึกเมื่อเข้าคิว</span><span className="mt-1 block text-xs font-normal text-muted-foreground">เปิดข้อมูลผู้รับและใบสั่งเมื่อเข้าคิว</span></>}>
        {job.contextSnapshot ? <ContextDetails context={job.contextSnapshot} /> : <p className="text-sm text-muted-foreground">งานเดิมนี้ไม่มีข้อมูลย้อนหลังที่บันทึกไว้ ข้อมูลปัจจุบันด้านล่างอาจต่างจากตอนสร้างงาน</p>}
      </Disclosure>
      <Disclosure title={<><span className="block">ข้อมูลปัจจุบัน</span><span className="mt-1 block text-xs font-normal text-muted-foreground">เปิดข้อมูลผู้รับและใบสั่งปัจจุบัน</span></>}>
        <p className="text-xs text-muted-foreground">ใช้ตรวจความพร้อมสำหรับการประมวลผลครั้งถัดไป ข้อมูลนี้ไม่ใช่สำเนาอีเมลที่ส่งไปแล้ว</p>
        <ContextDetails context={job.currentContext} />
      </Disclosure>
      <Disclosure title="รหัสงานและเวลาทั้งหมด">
        <dl className="space-y-3">
          <Field label="รหัสงาน"><CopyIdentifier value={job.id} label="รหัสงาน" /></Field>
          <Field label="รหัสเอกสาร"><CopyIdentifier value={job.expenseClaimId} label="รหัสเอกสาร" /></Field>
          <Field label="รหัสหัวหน้า"><CopyIdentifier value={job.leaderUserId} label="รหัสหัวหน้า" /></Field>
          {errorCode && <Field label="รหัสข้อผิดพลาดล่าสุด"><code className="break-all text-xs">{errorCode}</code></Field>}
          {job.messageId && <Field label="Message-ID"><CopyIdentifier value={job.messageId} label="Message-ID ของงาน" /></Field>}
        </dl>
        <dl className="grid grid-cols-1 gap-x-5 gap-y-3 border-t pt-4 sm:grid-cols-2">
          <Field label="จัดคิว">{displayTime(job.createdAt)}</Field>
          <Field label="อัปเดตงาน">{displayTime(job.updatedAt)}</Field>
          <Field label="กำหนดประมวลผล/ลองใหม่ที่บันทึกไว้">{displayTime(job.nextAttemptAt)}</Field>
          <Field label="หมดเวลาจองงาน">{displayTime(job.leaseExpiresAt)}</Field>
          <Field label="SMTP รับเมื่อ">{displayTime(job.acceptedAt)}</Field>
        </dl>
        <div className="space-y-2 border-t pt-4">
          <h4 className="text-sm font-medium">รหัสคำขอยืนยันในงาน ({job.verificationIds.length})</h4>
          <ul className="space-y-2">{job.verificationIds.map((id) => <li key={id}><CopyIdentifier value={id} label="รหัสคำขอยืนยัน" /></li>)}</ul>
        </div>
      </Disclosure>
    </div>
  </div>;
}
