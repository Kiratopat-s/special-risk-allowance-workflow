"use client";

/**
 * LeaderVerifyClient
 *
 * Renders the one-time external-leader verification flow.
 * Also used by internal leaders who click a link directly.
 * Includes an inline signature canvas step before confirming.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  PenLine,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getVerificationByToken,
  verifyByToken,
} from "@/app/actions/leader-verify";
import { monthDisplay, dateDisplay } from "@/lib/shared/format";

type LoadState = "loading" | "ready" | "not_found" | "already_verified";
type SubmitState = "idle" | "submitting" | "done" | "error";
/** choose = pick existing vs draw new; draw = canvas open; ready = signature captured */
type SigStep = "choose" | "draw" | "ready";

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

// ─── Inline signature canvas ──────────────────────────────────────────────────

function SignatureCanvas({
  onCapture,
  onCancel,
}: {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);

  const canvasPos = useCallback(
    (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const src = "touches" in e ? e.touches[0] : e;
      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    const id = setTimeout(initCanvas, 50);
    return () => clearTimeout(id);
  }, [initCanvas]);

  const startDraw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      drawing.current = true;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = canvasPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      e.preventDefault();
    },
    [canvasPos],
  );

  const moveDraw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = canvasPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasStrokes.current = true;
      e.preventDefault();
    },
    [canvasPos],
  );

  const stopDraw = useCallback(() => {
    drawing.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", moveDraw);
      canvas.removeEventListener("mouseup", stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", moveDraw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [startDraw, moveDraw, stopDraw]);

  const handleClear = () => {
    hasStrokes.current = false;
    initCanvas();
  };

  const handleConfirm = () => {
    if (!hasStrokes.current) return;
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    onCapture(dataUrl);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-center">
        วาดลายเซ็นของคุณด้านล่าง
      </p>
      <canvas
        ref={canvasRef}
        className="w-full h-36 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-white touch-none cursor-crosshair"
        style={{ touchAction: "none" }}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" /> ล้าง
        </Button>
        <Button size="sm" onClick={handleConfirm} className="flex-1 gap-1.5">
          <PenLine className="h-3.5 w-3.5" /> ใช้ลายเซ็นนี้
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderVerifyClient({
  token,
  existingSignatureDataUrl,
}: {
  token: string | null;
  existingSignatureDataUrl?: string | null;
}) {
  const [loadState, setLoadState] = useState<LoadState>(
    token ? "loading" : "not_found",
  );
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [, startTransition] = useTransition();

  // Signature flow state
  const initialSigStep: SigStep = existingSignatureDataUrl ? "choose" : "draw";
  const [sigStep, setSigStep] = useState<SigStep>(initialSigStep);
  const [capturedSig, setCapturedSig] = useState<string | null>(
    // If existing sig but no draw required yet, don't pre-set — wait for user choice
    null,
  );

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

  const handleVerify = (sigDataUrl: string) => {
    if (!token) return;
    setSubmitState("submitting");
    startTransition(async () => {
      const res = await verifyByToken(token, sigDataUrl);
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
      <div
        aria-busy="true"
        className="space-y-4 rounded-2xl border bg-card p-8 shadow-md"
      >
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
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

  // ──────────── Signature capture section ────────────

  const renderSignatureSection = () => {
    // "choose" — logged-in user with existing signature
    if (sigStep === "choose" && existingSignatureDataUrl) {
      return (
        <div className="rounded-xl border p-4 space-y-3">
          <p className="text-sm font-medium">ลายเซ็นของคุณ</p>
          <div className="rounded-lg border bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingSignatureDataUrl}
              alt="ลายเซ็นที่บันทึกไว้"
              className="h-16 w-full object-contain"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setCapturedSig(existingSignatureDataUrl)}
            >
              <Star className="h-3.5 w-3.5" />
              ใช้ลายเซ็นที่บันทึกไว้
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setSigStep("draw")}
            >
              <PenLine className="h-3.5 w-3.5" />
              เซ็นใหม่
            </Button>
          </div>
        </div>
      );
    }

    // "draw" — canvas open
    if (sigStep === "draw" || sigStep === "ready") {
      if (capturedSig && sigStep === "ready") {
        return (
          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              ลายเซ็นพร้อมใช้งาน
            </p>
            <div className="rounded-lg border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedSig}
                alt="ลายเซ็น"
                className="h-16 w-full object-contain"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setCapturedSig(null);
                setSigStep("draw");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> เซ็นใหม่
            </Button>
          </div>
        );
      }

      return (
        <SignatureCanvas
          onCapture={(dataUrl) => {
            setCapturedSig(dataUrl);
            setSigStep("ready");
          }}
          onCancel={() => {
            if (existingSignatureDataUrl) {
              setSigStep("choose");
            }
          }}
        />
      );
    }

    return null;
  };

  const readyToSubmit =
    capturedSig !== null ||
    (sigStep === "choose" && existingSignatureDataUrl !== null);

  const submitSig = capturedSig ?? existingSignatureDataUrl ?? "";

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-md space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <ShieldCheck className="mx-auto h-10 w-10 text-sky-500" />
        <h1 className="text-xl font-semibold">
          ยืนยันการออกปฏิบัติงานนอกสถานที่
        </h1>
        <p className="text-sm text-muted-foreground">
          กรุณาตรวจสอบข้อมูลและลงลายเซ็นยืนยัน
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

      {/* Signature section */}
      {renderSignatureSection()}

      {/* Error */}
      {submitState === "error" && submitError ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      {/* Action */}
      <LoadingButton
        className="w-full"
        onClick={() => handleVerify(submitSig)}
        disabled={submitState === "submitting" || !readyToSubmit}
        isLoading={submitState === "submitting"}
        loadingText="กำลังยืนยัน"
      >
        <ShieldCheck className="mr-2 h-4 w-4" />
        {readyToSubmit ? "ยืนยันการออกปฏิบัติงาน" : "กรุณาลงลายเซ็นก่อน"}
      </LoadingButton>

      <p className="text-center text-xs text-muted-foreground">
        ลิงก์หมดอายุ: {dateDisplay(info.expiresAt)}
      </p>
    </div>
  );
}
