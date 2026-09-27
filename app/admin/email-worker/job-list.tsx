"use client";

import { useMediaQuery } from "@mui/material";
import { ChevronRight } from "lucide-react";
import type { EmailDeliveryListItem } from "@/lib/domains/email-delivery/dashboard-types";
import { thaiDateFormat, THAILAND_TIME_ZONE } from "@/lib/shared/format";
import { Button } from "@/components/workflow-ui/button";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/workflow-ui/table";
import { CopyIdentifier } from "./copy-identifier";
import { DeliveryStatusBadge } from "./status-indicator";
import { displayMonth, displayTime, errorMessage } from "./presentation";

export function jobPrimaryTime(job: EmailDeliveryListItem) {
  if (job.status === "ACCEPTED" && job.acceptedAt) return { label: "SMTP รับเมื่อ", value: job.acceptedAt };
  if (job.status === "PENDING") return { label: "กำหนดประมวลผล", value: job.nextAttemptAt };
  if (job.status === "RETRY_WAIT") return { label: "กำหนดลองใหม่", value: job.nextAttemptAt };
  return { label: "อัปเดตล่าสุด", value: job.updatedAt };
}

function JobTime({ job }: { job: EmailDeliveryListItem }) {
  const { label, value } = jobPrimaryTime(job);
  return <div className="space-y-1 text-xs">
    <p className="text-muted-foreground">{label}</p>
    {value ? <time dateTime={new Date(value).toISOString()} title={displayTime(value)} className="tabular-nums">{thaiDateFormat(value, {
      timeZone: THAILAND_TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    })}</time> : <span>—</span>}
  </div>;
}

function SourceNote({ job }: { job: EmailDeliveryListItem }) {
  if (job.contextSource === "SNAPSHOT") return null;
  return <p className="mt-1 text-xs text-muted-foreground">{job.contextSource === "CURRENT" ? "ชื่อและเดือนจากข้อมูลปัจจุบัน · ไม่มีข้อมูลย้อนหลัง" : "ไม่พบข้อมูลย้อนหลังหรือข้อมูลปัจจุบัน"}</p>;
}

function Counts({ job }: { job: EmailDeliveryListItem }) {
  return <div className="space-y-1 tabular-nums"><p><span className="font-medium">{job.attemptCount}</span> <span className="text-xs text-muted-foreground">ทั้งหมด</span></p><p className="text-xs text-muted-foreground">รอบนี้ {job.cycleAttemptCount}</p></div>;
}

function DetailsButton({ id, openJob }: { id: string; openJob: (id: string) => void }) {
  return <Button variant="outline" size="sm" className="min-h-11" aria-label={`รายละเอียดงาน ${id}`} onClick={() => openJob(id)}>รายละเอียด<ChevronRight aria-hidden="true" /></Button>;
}

export function JobList({ jobs, loading, openJob }: {
  jobs: EmailDeliveryListItem[]; loading: boolean; openJob: (id: string) => void;
}) {
  const desktop = useMediaQuery("(min-width:1024px)", { defaultMatches: true });
  const empty = <div className="py-8 text-center"><p className="font-medium">ไม่พบงานอีเมล</p><p className="mt-1 text-sm text-muted-foreground">เปลี่ยนตัวกรอง หรือรอเอกสารที่สร้างคำขอยืนยันใหม่</p></div>;
  if (!desktop) return <div role="region" aria-label="รายการงานอีเมลบนมือถือ" aria-busy={loading} className="min-w-0 rounded-lg border bg-card">
    {jobs.length === 0 ? empty : <ul className="divide-y">{jobs.map((job) => <li key={job.id} className="min-w-0 space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 font-medium [overflow-wrap:anywhere]">{job.leaderName || "ไม่พบข้อมูลชื่อหัวหน้า"}</p><DeliveryStatusBadge status={job.status} /></div>
      <p className="break-all text-sm">{job.recipientEmail || "ไม่มีอีเมลที่บันทึกไว้"}</p>
      {job.lastErrorCode && <p className="text-sm text-muted-foreground">{errorMessage(job.lastErrorCode)}</p>}
      <div className="text-sm"><p className="[overflow-wrap:anywhere]">ผู้ยื่น: {job.claimantName || "ไม่พบข้อมูลผู้ยื่น"}</p><p className="mt-1 text-muted-foreground">{displayMonth(job.expenseMonth)}</p><SourceNote job={job} /></div>
      <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="mb-1 text-xs text-muted-foreground">ครั้งที่ประมวลผล</p><Counts job={job} /></div><JobTime job={job} /></div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 border-t pt-2"><CopyIdentifier value={job.id} label="รหัสงาน" short /><DetailsButton id={job.id} openJob={openJob} /></div>
    </li>)}</ul>}
  </div>;
  return <TableContainer role="region" aria-label="ตารางงานอีเมล" tabIndex={0} aria-busy={loading} className="rounded-lg border bg-card">
    <Table className="w-full table-fixed [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-3">
      <colgroup>{[20, 22, 19, 11, 15, 13].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <TableHead><TableRow><TableHeader>ผู้ยื่น / เอกสาร</TableHeader><TableHeader>ผู้รับ</TableHeader><TableHeader>สถานะ / สาเหตุ</TableHeader><TableHeader className="whitespace-normal!">ครั้งที่ประมวลผล</TableHeader><TableHeader>เวลา</TableHeader><TableHeader>รายละเอียด</TableHeader></TableRow></TableHead>
      <TableBody>{jobs.length === 0 ? <TableRow><TableCell colSpan={6}>{empty}</TableCell></TableRow> : jobs.map((job) => <TableRow key={job.id}>
        <TableCell className="align-top"><p className="font-medium [overflow-wrap:anywhere]">{job.claimantName || "ไม่พบข้อมูลผู้ยื่น"}</p><p className="mt-1 text-xs text-muted-foreground">{displayMonth(job.expenseMonth)}</p><SourceNote job={job} /><CopyIdentifier value={job.id} label="รหัสงาน" short /></TableCell>
        <TableCell className="align-top"><p className="font-medium [overflow-wrap:anywhere]">{job.leaderName || "ไม่พบข้อมูลชื่อหัวหน้า"}</p><p className="mt-1 break-all text-sm text-muted-foreground">{job.recipientEmail || "ไม่มีอีเมลที่บันทึกไว้"}</p></TableCell>
        <TableCell className="align-top"><DeliveryStatusBadge status={job.status} />{job.lastErrorCode && <p className="mt-2 text-xs text-muted-foreground">{errorMessage(job.lastErrorCode)}</p>}</TableCell>
        <TableCell className="align-top"><Counts job={job} /></TableCell>
        <TableCell className="align-top"><JobTime job={job} /></TableCell>
        <TableCell className="align-top"><DetailsButton id={job.id} openJob={openJob} /></TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </TableContainer>;
}
