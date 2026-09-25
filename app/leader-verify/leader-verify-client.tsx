"use client";

import { runServerAction } from "@/lib/deployment/client";
import { useWorkflowTransition as useTransition } from "@/lib/hooks/use-workflow-transition";

/**
 * LeaderVerifyClient
 *
 * Renders the one-time external-leader verification flow.
 * Also used by internal leaders who click a link directly.
 * Includes an inline signature canvas step before confirming.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  PenLine,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/workflow-ui/button";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClaimDetailContent } from "@/components/expense-claims/claim-detail-content";
import type { TokenVerificationView } from "@/lib/domains/leader-verification";
import { datesWithinOrder, formatClaimDateRanges, normalizeClaimDates } from "@/lib/ui/claim-dates";
import {
  getVerificationByToken,
  verifyByToken,
} from "@/app/actions/leader-verify";
import { dateDisplay } from "@/lib/shared/format";

type VerificationView = TokenVerificationView | { state: "loading" | "not_found" } | { state: "error"; message: string };
type SubmitState = "idle" | "submitting" | "done" | "error";
/** choose = pick existing vs draw new; draw = canvas open; ready = signature captured */
type SigStep = "choose" | "draw" | "ready";

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

interface LeaderVerifyClientProps {
  token: string | null;
  existingSignatureDataUrl?: string | null;
}

export function LeaderVerifyClient(props: LeaderVerifyClientProps) {
  // A different link must never reuse the previous claim or captured signature.
  return <TokenVerification key={props.token} {...props} />;
}

function TokenVerification({
  token,
  existingSignatureDataUrl,
}: LeaderVerifyClientProps) {
  const [view, setView] = useState<VerificationView>({ state: token ? "loading" : "not_found" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExpired, setExpired] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  const [, startTransition] = useTransition();

  // Signature flow state
  const initialSigStep: SigStep = existingSignatureDataUrl ? "choose" : "draw";
  const [sigStep, setSigStep] = useState<SigStep>(initialSigStep);
  const [capturedSig, setCapturedSig] = useState<string | null>(null);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await runServerAction(() => getVerificationByToken(token));
        if (cancelled) return;
        if (res === undefined) {
          setView({ state: "error", message: "กรุณาโหลดหน้าใหม่เพื่อดูรายละเอียดคำขอ" });
        } else if (res.success) {
          setExpired(res.data.state === "ready" && new Date(res.data.expiresAt).getTime() <= Date.now());
          setView(res.data);
        } else if (["INVALID_TOKEN", "TOKEN_NOT_FOUND", "TOKEN_EXPIRED", "VERIFICATION_NOT_FOUND", "CLAIM_NOT_FOUND"].includes(res.code ?? "")) {
          setView({ state: "not_found" });
        } else {
          setView({ state: "error", message: res.error });
        }
      } catch {
        if (!cancelled) setView({ state: "error", message: "โหลดรายละเอียดไม่สำเร็จ กรุณาลองใหม่" });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, loadAttempt]);

  const expiresAt = view.state === "ready" ? new Date(view.expiresAt).getTime() : null;
  useEffect(() => {
    if (expiresAt === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) setExpired(true);
      else timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
    };
    timer = setTimeout(checkExpiry, Math.max(0, Math.min(expiresAt - Date.now(), 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const handleVerify = (sigDataUrl: string) => {
    if (!token || view.state !== "ready" || !sigDataUrl || inFlight.current || submitState === "done") return;
    if (isExpired || new Date(view.expiresAt).getTime() <= Date.now()) {
      setExpired(true);
      return;
    }
    inFlight.current = true;
    setSubmitState("submitting");
    setSubmitError(null);
    startTransition(async () => {
      try {
        const res = await runServerAction(() => verifyByToken(token, sigDataUrl));
        if (!active.current) return;
        if (res === undefined) {
          setSubmitState("idle");
        } else if (!res.success) {
          setSubmitState("error");
          setSubmitError(res.error);
          if (res.code === "TOKEN_EXPIRED") setExpired(true);
        } else {
          setSubmitState("done");
        }
      } catch {
        if (active.current) {
          setSubmitState("error");
          setSubmitError("ยืนยันไม่สำเร็จ ข้อมูลลายเซ็นยังอยู่ กรุณาลองใหม่");
        }
      } finally {
        inFlight.current = false;
      }
    });
  };

  // ──────────── Render states ────────────

  if (view.state === "loading") {
    return (
      <div
        aria-busy="true"
        className="space-y-4 rounded-2xl border bg-card p-8 shadow-md"
      >
        <div className="space-y-2">
          <Skeleton className="h-6 w-full max-w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (view.state === "error") {
    return <div role="alert" className="space-y-4 rounded-2xl border bg-card p-6 text-center">
      <p>{view.message}</p>
      <Button variant="outline" onClick={() => {
        setView({ state: "loading" });
        setLoadAttempt((attempt) => attempt + 1);
      }}>ลองใหม่</Button>
    </div>;
  }

  if (view.state === "not_found") {
    return (
      <div className="rounded-2xl border bg-card p-8 shadow-md text-center space-y-3">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h2>
        <p className="text-sm text-muted-foreground">
          ลิงก์นี้อาจหมดอายุ ใช้งานไปแล้ว หรือไม่มีอยู่ในระบบ
        </p>
        <p className="text-sm text-muted-foreground">
          กรุณาติดต่อผู้ยื่นเอกสารเพื่อขอลิงก์ใหม่
        </p>
      </div>
    );
  }

  if (view.state === "already_verified") {
    return (
      <div className="rounded-2xl border bg-card p-8 shadow-md text-center space-y-3">
        <ShieldCheck className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">
          ยืนยันการออกปฏิบัติงานเรียบร้อยแล้ว
        </h2>
        <p className="text-sm text-muted-foreground">
          เลขที่เอกสาร: <strong className="break-all">{view.offSiteWorkId}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          ยืนยันเมื่อ: {dateDisplay(view.verifiedAt, { timeZone: "Asia/Bangkok" })}
        </p>
      </div>
    );
  }

  if (submitState === "done") {
    return (
      <div className="rounded-2xl border bg-card p-8 shadow-md text-center space-y-3">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">
          ยืนยันสำเร็จ
        </h2>
        <p className="text-sm text-muted-foreground">
          ระบบได้บันทึกการยืนยันของคุณแล้ว ขอบคุณครับ/ค่ะ
        </p>
      </div>
    );
  }

  if (view.state !== "ready") return null;
  const info = view;
  const { dates } = normalizeClaimDates(info.expenseClaim.expenseMonth, info.expenseClaim.selectedDates, info.expenseClaim.countDates);
  const matchingDates = datesWithinOrder(dates, info.offSiteWork);
  const expired = isExpired;

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
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => { setCapturedSig(existingSignatureDataUrl); setSigStep("ready"); }}
            >
              <Star className="h-3.5 w-3.5" />
              ใช้ลายเซ็นที่บันทึกไว้
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { setCapturedSig(null); setSigStep("draw"); }}
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
              setCapturedSig(null);
              setSigStep("choose");
            }
          }}
        />
      );
    }

    return null;
  };

  // A saved signature must not be submitted while drawing its replacement.
  const submitSig = sigStep === "draw" ? null : capturedSig ?? existingSignatureDataUrl ?? null;
  const readyToSubmit = submitSig !== null && !expired;

  return (
    <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-md space-y-6 sm:p-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <ShieldCheck className="mx-auto h-10 w-10 text-sky-500" />
        <h2 className="text-xl font-semibold">
          ยืนยันการออกปฏิบัติงานนอกสถานที่
        </h2>
        <p className="text-sm text-muted-foreground">
          กรุณาตรวจสอบข้อมูลและลงลายเซ็นยืนยัน
        </p>
      </div>

      <section className="space-y-4" aria-label="รายละเอียดคำขอ">
        <div>
          <h3 className="font-semibold">รายละเอียดคำขอ</h3>
          <p className="mt-1 break-all text-xs text-muted-foreground">เลขเอกสาร {info.expenseClaim.id}</p>
          <p className="mt-2 text-sm text-muted-foreground">จำนวนวันและยอดเงินด้านล่างเป็นยอดรวมทั้งคำขอ</p>
        </div>
        <ClaimDetailContent
          claim={info.expenseClaim}
          highlightedDates={matchingDates}
          highlightedOffSiteWorkId={info.offSiteWorkId}
        />
      </section>

      <section className="space-y-2 border-t pt-5 text-sm" aria-label="คำสั่งที่กำลังยืนยัน">
        <h3 className="break-words font-semibold">คุณกำลังยืนยันคำสั่ง {info.offSiteWork.innerRefDocumentId || info.offSiteWork.id}</h3>
        <p className="font-medium">
          วันที่เบิกในช่วงคำสั่งนี้: {matchingDates.length
            ? `${formatClaimDateRanges(matchingDates)} · ${matchingDates.length} วัน`
            : dates.length ? "ไม่มีวันเบิกตรงกับช่วงคำสั่งนี้" : "ไม่มีวันที่เบิกที่บันทึกไว้"}
        </p>
        <p className="text-muted-foreground">การลงนามครั้งนี้ยืนยันเฉพาะคำสั่งที่ระบุ วันเบิกอาจอยู่ในหลายช่วงคำสั่ง ยอดรวมเอกสารนับแต่ละวันครั้งเดียว</p>
      </section>

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
      {!expired && <fieldset disabled={submitState === "submitting"} className="min-w-0" aria-label="ลายเซ็นสำหรับยืนยันคำสั่ง">
        <div className={submitState === "submitting" ? "pointer-events-none" : undefined}>
          {renderSignatureSection()}
        </div>
      </fieldset>}
      {expired && <p role="alert" className="text-sm text-destructive">ลิงก์ยืนยันหมดอายุแล้ว กรุณาติดต่อผู้ยื่นเอกสารเพื่อขอลิงก์ใหม่</p>}

      {/* Error */}
      {submitState === "error" && submitError ? (
        <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      {/* Action */}
      <LoadingButton
        className="w-full"
        onClick={() => submitSig && handleVerify(submitSig)}
        disabled={submitState === "submitting" || !readyToSubmit}
        isLoading={submitState === "submitting"}
        loadingText="กำลังยืนยัน"
      >
        <ShieldCheck className="h-4 w-4" />
        {expired ? "หมดอายุ — ติดต่อผู้ยื่น" : readyToSubmit ? "ยืนยันการออกปฏิบัติงาน" : "กรุณาลงลายเซ็นก่อน"}
      </LoadingButton>

      <p className="text-center text-xs text-muted-foreground">
        ลิงก์หมดอายุ: {dateDisplay(info.expiresAt, { timeZone: "Asia/Bangkok" })}
      </p>
    </div>
  );
}
