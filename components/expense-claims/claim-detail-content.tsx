import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ClaimDatesCalendar } from "./claim-dates-calendar";
import { claimStatusVariant } from "@/lib/shared/claim-status";
import { dateDisplay, decimalText, monthDisplay } from "@/lib/shared/format";
import type { ClaimDocumentStatus } from "@/lib/shared/types";

export interface ClaimDetailData {
  id: string;
  expenseMonth: Date | string;
  claimantPositionAtSubmission: string;
  selectedDates: string[] | null;
  countDates: number | null;
  amount: number | null;
  status: string;
  remark: string | null;
  claimant: { firstName: string; lastName: string; employeeId?: string | null };
  expenseClaimOffSiteWorks: Array<{
    offSiteWorkId: string;
    offSiteWork: { id: string; innerRefDocumentId: string | null; startDate: Date | string; endDate: Date | string; location: string | null; objective: string | null };
  }>;
}

const STATUS_LABEL: Record<ClaimDocumentStatus, string> = {
  DRAFT: "ร่าง", PENDING: "รอดำเนินการ", PENDING_LEADER_VERIFY: "รอหัวหน้ายืนยัน", WAIT_FOR_COLLECTION: "รอรวบรวม", COLLECTED: "รวบรวมแล้ว", APPROVED: "อนุมัติ", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก",
};

/** Presentation only: callers own authorization, loading, document links and actions. */
export function ClaimDetailContent({ claim, children }: { claim: ClaimDetailData; children?: ReactNode }) {
  return (
    <div className="space-y-6 text-sm">
      <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">ผู้ยื่น</dt><dd className="mt-1 break-words font-medium">{claim.claimant.firstName} {claim.claimant.lastName}{claim.claimant.employeeId && <span className="mt-1 block text-xs font-normal text-muted-foreground">รหัสพนักงาน {claim.claimant.employeeId}</span>}</dd></div>
        <div><dt className="text-xs text-muted-foreground">ตำแหน่งเมื่อยื่นเบิก</dt><dd className="mt-1 break-words font-medium">{claim.claimantPositionAtSubmission || "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">เดือน</dt><dd className="mt-1 font-medium">{monthDisplay(claim.expenseMonth)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">สถานะ</dt><dd className="mt-1"><Badge variant={claimStatusVariant(claim.status as ClaimDocumentStatus)}>{STATUS_LABEL[claim.status as ClaimDocumentStatus] ?? claim.status}</Badge></dd></div>
        <div><dt className="text-xs text-muted-foreground">จำนวนวันที่ขอเบิก</dt><dd className="mt-1 font-medium tabular-nums">{decimalText(claim.countDates)} วัน</dd></div>
        <div><dt className="text-xs text-muted-foreground">จำนวนเงิน</dt><dd className="mt-1 font-medium tabular-nums">{decimalText(claim.amount)} บาท</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">หมายเหตุ</dt><dd className="mt-1 whitespace-pre-wrap break-words">{claim.remark || "—"}</dd></div>
      </dl>
      {children}
      <div className="border-t pt-5"><ClaimDatesCalendar expenseMonth={claim.expenseMonth} selectedDates={claim.selectedDates} countDates={claim.countDates} /></div>
      <section className="space-y-3 border-t pt-5" aria-label="คำสั่งที่ใช้ประกอบการเบิก">
        <h3 className="font-medium">คำสั่งที่ใช้ประกอบการเบิก ({claim.expenseClaimOffSiteWorks.length})</h3>
        {claim.expenseClaimOffSiteWorks.length === 0 ? <p className="text-muted-foreground">ไม่มีคำสั่งที่เชื่อมไว้</p> : <ul className="divide-y">{claim.expenseClaimOffSiteWorks.map(({ offSiteWorkId, offSiteWork: work }) => <li key={offSiteWorkId} className="space-y-1 py-3 first:pt-0 last:pb-0">
          <p className="break-words font-medium">{work.innerRefDocumentId || work.id}</p>
          {work.innerRefDocumentId && <p className="break-all text-xs text-muted-foreground">เลขที่เอกสาร {work.id}</p>}
          <p className="text-muted-foreground">{dateDisplay(work.startDate)} – {dateDisplay(work.endDate)}</p>
          <p className="break-words"><span className="text-muted-foreground">สถานที่: </span>{work.location || "—"}</p>
          <p className="whitespace-pre-wrap break-words"><span className="text-muted-foreground">วัตถุประสงค์: </span>{work.objective || "—"}</p>
        </li>)}</ul>}
      </section>
    </div>
  );
}
