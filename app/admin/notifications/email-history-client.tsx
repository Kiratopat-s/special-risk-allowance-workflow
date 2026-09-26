"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, MenuItem, Skeleton, TextField } from "@mui/material";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { listEmailDeliveries, retryEmailDelivery } from "@/app/actions/email-deliveries";
import { Button } from "@/components/workflow-ui/button";
import { Input } from "@/components/workflow-ui/input";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/workflow-ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { runServerAction } from "@/lib/deployment/client";
import type { EmailDeliveryStatus, EmailDeliveryView } from "@/lib/domains/email-delivery/types";
import { dateTimeDisplay } from "@/lib/shared/format";
import type { PaginatedResult } from "@/lib/shared/types";

const statusLabels: Record<EmailDeliveryStatus, string> = {
  PENDING: "รอส่ง",
  PROCESSING: "กำลังส่ง",
  RETRY_WAIT: "รอลองใหม่",
  ACCEPTED: "SMTP รับแล้ว",
  FAILED: "ส่งไม่สำเร็จ",
  SKIPPED: "ข้ามการส่ง",
};

function failureMessage(code: string | null): string {
  if (!code) return "—";
  const messages: Record<string, string> = {
    EMAIL_CONFIGURATION_INVALID: "ตรวจสอบการตั้งค่า SMTP และ URL ของระบบก่อนลองใหม่",
    SMTP_AUTHENTICATION_FAILED: "ตรวจสอบบัญชีและรหัสผ่าน SMTP ก่อนลองใหม่",
    SMTP_TLS_CONFIGURATION_INVALID: "ตรวจสอบใบรับรองและการเชื่อมต่อ TLS ของ SMTP ก่อนลองใหม่",
    INVALID_RECIPIENT: "ตรวจสอบอีเมลหลักของหัวหน้าก่อนลองใหม่",
    INVALID_RECIPIENT_EMAIL: "ตรวจสอบอีเมลหลักของหัวหน้าก่อนลองใหม่",
    RECIPIENT_INACTIVE: "ตรวจสอบสถานะบัญชีหัวหน้าก่อนลองใหม่",
    SMTP_PERMANENT_REJECTION: "เซิร์ฟเวอร์ปฏิเสธอีเมล กรุณาตรวจสอบผู้รับและการตั้งค่า",
    SMTP_RECIPIENT_NOT_ACCEPTED: "เซิร์ฟเวอร์ไม่รับอีเมลผู้รับนี้ กรุณาตรวจสอบอีเมลหลักของหัวหน้า",
    SMTP_TEMPORARY_REJECTION: "เซิร์ฟเวอร์อีเมลขัดข้องชั่วคราว",
    SMTP_CONNECTION_FAILED: "เชื่อมต่อเซิร์ฟเวอร์อีเมลไม่สำเร็จหรือหมดเวลา",
    SMTP_SEND_FAILED: "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบสาเหตุก่อนลองใหม่",
    INVALID_EMAIL_CONTENT: "ข้อมูลสำหรับสร้างอีเมลไม่ครบถ้วน กรุณาตรวจสอบเอกสาร",
    CLAIM_NO_LONGER_PENDING: "เอกสารไม่ได้อยู่ในขั้นตอนรอหัวหน้ายืนยันแล้ว",
    NO_PENDING_VERIFICATIONS: "ไม่มีรายการรอยืนยันที่ยังใช้งานได้ในคำขอนี้",
    WORKER_INTERRUPTED: "การส่งถูกขัดจังหวะก่อนบันทึกผลสำเร็จ",
    RETRY_EXHAUSTED: "ลองส่งครบจำนวนครั้งแล้ว กรุณาตรวจสอบสาเหตุก่อนลองใหม่",
    TRANSPORT_UNEXPECTED: "ระบบส่งอีเมลขัดข้องชั่วคราว",
  };
  // Only display machine codes. Never render an arbitrary SMTP response/error message.
  const safeCode = /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : null;
  return messages[code] ?? (safeCode ? `รหัส: ${safeCode}` : "ไม่สามารถดำเนินการได้ กรุณาตรวจสอบการตั้งค่าและผู้รับ");
}

function timestamp(value: Date | null): string {
  return value ? dateTimeDisplay(value) : "—";
}

export function EmailHistoryClient() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<{ page: number; status?: EmailDeliveryStatus; search: string }>({ page: 1, search: "" });
  const [result, setResult] = useState<PaginatedResult<EmailDeliveryView> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [isLoading, startLoading] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    startLoading(async () => {
      setError(null);
      try {
        const response = await runServerAction(() => listEmailDeliveries(filters));
        if (!current || response === undefined) return;
        if (response.success) setResult(response.data);
        else setError(response.error);
      } catch {
        if (current) setError("เชื่อมต่อไม่สำเร็จ กรุณากดรีเฟรชเพื่อลองโหลดประวัติอีกครั้ง");
      }
    });
    return () => { current = false; };
  }, [filters, refresh]);

  async function retry(delivery: EmailDeliveryView) {
    if (retryingId || delivery.status !== "FAILED" || !delivery.canRetry) return;
    setRetryingId(delivery.id);
    try {
      const response = await runServerAction(() => retryEmailDelivery(delivery.id));
      if (response === undefined) return;
      if (!response.success) {
        toast.error("ยังไม่สามารถลองส่งใหม่ได้", { description: response.error });
        return;
      }
      toast.success("จัดคิวอีเมลเพื่อลองส่งใหม่แล้ว");
      setRefresh((value) => value + 1);
    } catch {
      toast.error("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setRetryingId(null);
    }
  }

  const busy = isLoading || retryingId !== null;

  return (
    <section aria-labelledby="email-history-heading" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="email-history-heading" className="text-xl font-semibold">ประวัติอีเมล</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            ติดตามอีเมลขอให้หัวหน้ายืนยันการปฏิบัติงาน สถานะ “SMTP รับแล้ว” หมายถึงเซิร์ฟเวอร์รับอีเมลแล้ว ยังไม่ยืนยันว่าเข้ากล่องจดหมายหรืออ่านแล้ว
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />รีเฟรช
        </Button>
      </div>

      <form
        className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((value) => ({ ...value, page: 1, search: search.trim() }));
        }}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="email-history-search">ค้นหาอีเมลหรือรหัสเอกสาร</Label>
          <Input id="email-history-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={200} placeholder="อีเมลผู้รับ หรือรหัสเอกสาร" disabled={busy} />
        </div>
        <TextField
          select
          size="small"
          label="สถานะการส่ง"
          value={filters.status ?? ""}
          disabled={busy}
          onChange={(event) => setFilters((value) => ({ ...value, page: 1, status: (event.target.value || undefined) as EmailDeliveryStatus | undefined }))}
          className="sm:w-48"
        >
          <MenuItem value="">ทุกสถานะ</MenuItem>
          {Object.entries(statusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <Button type="submit" disabled={busy}><Search aria-hidden="true" className="h-4 w-4" />ค้นหา</Button>
      </form>

      {error && <Alert severity="error">{error}</Alert>}
      <div aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
        {isLoading ? "กำลังโหลดประวัติอีเมล…" : result ? `${result.pagination.total} รายการ · เวลาไทย` : ""}
      </div>
      {!result && isLoading && <div aria-hidden="true" className="space-y-2">{[0, 1, 2].map((index) => <Skeleton key={index} variant="rounded" height={64} />)}</div>}
      {result && (
        <>
          <p id="email-history-scroll-hint" className="text-xs text-muted-foreground md:hidden">เลื่อนตารางแนวนอนเพื่อดูเวลาและการดำเนินการ</p>
          <TableContainer role="region" aria-label="ประวัติการส่งอีเมล" aria-describedby="email-history-scroll-hint" tabIndex={0} aria-busy={isLoading} className="rounded-lg border border-border bg-card">
            <Table className="min-w-[960px]">
              <TableHead><TableRow>
                <TableHeader>ผู้รับ / เอกสาร</TableHeader>
                <TableHeader>สถานะ / สาเหตุ</TableHeader>
                <TableHeader>จำนวนครั้ง</TableHeader>
                <TableHeader>เวลา</TableHeader>
                <TableHeader>การดำเนินการ</TableHeader>
              </TableRow></TableHead>
              <TableBody>
                {result.data.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center">
                  <p className="font-medium">ไม่พบประวัติอีเมล</p>
                  <p className="mt-1 text-sm text-muted-foreground">ลองเปลี่ยนตัวกรอง หรือรอเอกสารที่ยื่นและสร้างคำขอยืนยันใหม่</p>
                </TableCell></TableRow> : result.data.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="max-w-72 align-top">
                      <p className="break-all font-medium">{delivery.recipientEmail || "ยังไม่ได้ระบุอีเมลที่ใช้ส่ง"}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">หัวหน้า: {delivery.leaderUserId}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">เอกสาร: {delivery.expenseClaimId}</p>
                    </TableCell>
                    <TableCell className="max-w-64 align-top">
                      <Badge variant={delivery.status === "FAILED" ? "destructive" : "secondary"}>{statusLabels[delivery.status]}</Badge>
                      {delivery.lastErrorCode && <p className="mt-2 text-xs text-muted-foreground">{failureMessage(delivery.lastErrorCode)}</p>}
                    </TableCell>
                    <TableCell className="align-top tabular-nums">{delivery.attemptCount}</TableCell>
                    <TableCell className="align-top text-xs">
                      <p>จัดคิว: {timestamp(delivery.createdAt)}</p>
                      {delivery.acceptedAt && <p className="mt-1">SMTP รับ: {timestamp(delivery.acceptedAt)}</p>}
                      {delivery.nextAttemptAt && (delivery.status === "RETRY_WAIT" || delivery.status === "PENDING") && <p className="mt-1">ลองครั้งถัดไป: {timestamp(delivery.nextAttemptAt)}</p>}
                    </TableCell>
                    <TableCell className="max-w-72 align-top">
                      {delivery.status === "FAILED" && delivery.canRetry && <LoadingButton
                        size="sm" variant="outline" disabled={busy} isLoading={retryingId === delivery.id} loadingText="กำลังจัดคิว"
                        aria-label={`ลองส่งใหม่สำหรับเอกสาร ${delivery.expenseClaimId} ถึง ${delivery.recipientEmail || delivery.leaderUserId}`}
                        onClick={() => void retry(delivery)}
                      >ลองส่งใหม่</LoadingButton>}
                      {delivery.status === "FAILED" && !delivery.canRetry && <p className="text-xs text-muted-foreground">ลองใหม่ได้เมื่อคำขอยังรอยืนยันและข้อมูลผู้รับพร้อมใช้งาน</p>}
                      {delivery.attempts.length > 0 && <details className="mt-2 text-xs">
                        <summary className="cursor-pointer rounded-sm py-1 text-primary focus-visible:outline-2 focus-visible:outline-offset-2">ประวัติการส่งและการจัดคิว ({delivery.attempts.length})</summary>
                        <ol className="mt-2 space-y-3">
                          {delivery.attempts.map((attempt) => <li key={attempt.id} className="space-y-1">
                            <p className="font-medium">{attempt.outcome === "MANUAL_RETRY" ? "จัดคิวใหม่โดยผู้ดูแล" : `ครั้งที่ ${attempt.attemptNumber} · ${attempt.outcome === "ACCEPTED" ? "SMTP รับแล้ว" : attempt.outcome === "INTERRUPTED" ? "ถูกขัดจังหวะ" : attempt.outcome === "RETRY_WAIT" ? "รอลองใหม่" : attempt.outcome === "FAILED" ? "ส่งไม่สำเร็จ" : attempt.outcome === "SKIPPED" ? "ข้ามการส่ง" : "เริ่มดำเนินการ"}`}</p>
                            <p>เริ่ม: {timestamp(attempt.startedAt)}</p>
                            {attempt.finishedAt && <p>สิ้นสุด: {timestamp(attempt.finishedAt)}</p>}
                            <p className="break-all">ผู้รับ: {attempt.recipientEmail || "—"}</p>
                            {attempt.errorCode && <p>{failureMessage(attempt.errorCode)}</p>}
                            {attempt.requestedById && <p className="break-all">ผู้สั่งลองใหม่: {attempt.requestedById}</p>}
                          </li>)}
                        </ol>
                      </details>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationControls
            pagination={result.pagination} isPending={busy}
            onPrevious={() => setFilters((value) => ({ ...value, page: value.page - 1 }))}
            onNext={() => setFilters((value) => ({ ...value, page: value.page + 1 }))}
          />
        </>
      )}
    </section>
  );
}
