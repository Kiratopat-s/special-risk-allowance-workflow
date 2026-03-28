"use client";

/**
 * LeaderVerifyClient
 *
 * Renders the one-time external-leader verification flow.
 * Also used by internal leaders who click a link directly.
 */

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getVerificationByToken,
  verifyByToken,
} from "@/app/actions/leader-verify";
import { monthDisplay, dateDisplay } from "@/lib/shared/format";

type LoadState = "loading" | "ready" | "not_found" | "already_verified";
type SubmitState = "idle" | "submitting" | "done" | "error";

interface VerificationInfo {
  id: string;
  offSiteWorkId: string;
  leaderEmail: string | null;
  expiresAt: Date;
  verifiedAt: Date | null;
  expenseClaim: {
    id: string;
    expenseMonth: Date;
    status: string;
    claimant: {
      firstName: string;
      lastName: string;
    };
  };
  offSiteWork: {
    id: string;
    innerRefDocumentId: string | null;
    startDate: Date;
    endDate: Date;
    location: string | null;
    objective: string | null;
    leaderFirstName: string | null;
    leaderLastName: string | null;
    leaderPosition: string | null;
  };
}

export function LeaderVerifyClient({ token }: { token: string | null }) {
  const [loadState, setLoadState] = useState<LoadState>(
    token ? "loading" : "not_found",
  );
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      const res = await getVerificationByToken(token);
      if (cancelled) return;

      if (!res.success) {
        setLoadState("not_found");
        return;
      }

      const data = res.data;

      if (data.verifiedAt) {
        setInfo(data as unknown as VerificationInfo);
        setLoadState("already_verified");
        return;
      }

      if (new Date(data.expiresAt) < new Date()) {
        setLoadState("not_found");
        return;
      }

      setInfo(data as unknown as VerificationInfo);
      setLoadState("ready");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleVerify = () => {
    if (!token) return;
    setSubmitState("submitting");
    startTransition(async () => {
      const res = await verifyByToken(token);
      if (!res.success) {
        setSubmitState("error");
        setSubmitError(res.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setSubmitState("done");
    });
  };

  // ──────────── Render states ────────────

  if (loadState === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (loadState === "not_found") {
    return (
      <div className="rounded-2xl border bg-card p-8 shadow-md text-center space-y-3">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-lg font-semibold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h1>
        <p className="text-sm text-muted-foreground">
          ลิงก์นี้อาจหมดอายุ ใช้งานไปแล้ว หรือไม่มีอยู่ในระบบ
        </p>
        <p className="text-sm text-muted-foreground">
          กรุณาติดต่อผู้ยื่นเอกสารเพื่อขอลิงก์ใหม่
        </p>
      </div>
    );
  }

  if (loadState === "already_verified" && info) {
    return (
      <div className="rounded-2xl border bg-card p-8 shadow-md text-center space-y-3">
        <ShieldCheck className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="text-lg font-semibold text-green-700 dark:text-green-400">
          ยืนยันการออกปฏิบัติงานเรียบร้อยแล้ว
        </h1>
        <p className="text-sm text-muted-foreground">
          เลขที่เอกสาร: <strong>{info.offSiteWorkId}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          ยืนยันเมื่อ: {info.verifiedAt ? dateDisplay(info.verifiedAt) : "-"}
        </p>
      </div>
    );
  }

  if (submitState === "done") {
    return (
      <div className="rounded-2xl border bg-card p-8 shadow-md text-center space-y-3">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="text-xl font-semibold text-green-700 dark:text-green-400">
          ยืนยันสำเร็จ
        </h1>
        <p className="text-sm text-muted-foreground">
          ระบบได้บันทึกการยืนยันของคุณแล้ว ขอบคุณครับ/ค่ะ
        </p>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-md space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <ShieldCheck className="mx-auto h-10 w-10 text-sky-500" />
        <h1 className="text-xl font-semibold">
          ยืนยันการออกปฏิบัติงานนอกสถานที่
        </h1>
        <p className="text-sm text-muted-foreground">
          กรุณาตรวจสอบข้อมูลและกดยืนยัน
        </p>
      </div>

      {/* Claimant info */}
      <div className="rounded-xl border bg-sky-50 dark:bg-sky-950/40 p-4 space-y-2 text-sm">
        <p className="font-medium text-sky-900 dark:text-sky-100">
          ข้อมูลผู้ยื่นเบิก
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <span>ชื่อ</span>
          <span className="font-medium text-foreground">
            {info.expenseClaim.claimant.firstName}{" "}
            {info.expenseClaim.claimant.lastName}
          </span>
          <span>เดือนที่เบิก</span>
          <span className="font-medium text-foreground">
            {monthDisplay(info.expenseClaim.expenseMonth)}
          </span>
          <span>เลขเอกสาร</span>
          <span className="font-medium text-foreground font-mono text-xs">
            {info.expenseClaim.id}
          </span>
        </div>
      </div>

      {/* Off-site work info */}
      <div className="rounded-xl border p-4 space-y-2 text-sm">
        <p className="font-medium">รายละเอียดการออกปฏิบัติงาน</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <span>เลขที่คำสั่ง</span>
          <span className="font-medium text-foreground font-mono text-xs">
            {info.offSiteWork.id}
          </span>
          {info.offSiteWork.innerRefDocumentId ? (
            <>
              <span>เลขอ้างอิง</span>
              <span>{info.offSiteWork.innerRefDocumentId}</span>
            </>
          ) : null}
          <span>ช่วงวันที่</span>
          <span>
            {dateDisplay(info.offSiteWork.startDate)} –{" "}
            {dateDisplay(info.offSiteWork.endDate)}
          </span>
          {info.offSiteWork.location ? (
            <>
              <span>สถานที่</span>
              <span>{info.offSiteWork.location}</span>
            </>
          ) : null}
          {info.offSiteWork.objective ? (
            <>
              <span>วัตถุประสงค์</span>
              <span>{info.offSiteWork.objective}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Leader name reminder */}
      {info.offSiteWork.leaderFirstName ? (
        <p className="text-sm text-muted-foreground text-center">
          ยืนยันในฐานะ:{" "}
          <strong>
            {info.offSiteWork.leaderFirstName} {info.offSiteWork.leaderLastName}
          </strong>
          {info.offSiteWork.leaderPosition
            ? ` (${info.offSiteWork.leaderPosition})`
            : ""}
        </p>
      ) : null}

      {/* Error */}
      {submitState === "error" && submitError ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      {/* Action */}
      <Button
        className="w-full"
        onClick={handleVerify}
        disabled={submitState === "submitting"}
      >
        {submitState === "submitting" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" />
        )}
        ยืนยันการออกปฏิบัติงาน
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        ลิงก์หมดอายุ: {dateDisplay(info.expiresAt)}
      </p>
    </div>
  );
}
