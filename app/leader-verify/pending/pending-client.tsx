"use client";

/**
 * PendingVerificationsClient
 *
 * Shows the authenticated leader's pending verification queue.
 * Each card requires the leader to provide a signature before confirming.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  ClipboardList,
  MapPin,
  PenLine,
  RotateCcw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import { verifyAsLeader } from "@/app/actions/leader-verify";
import type { LeaderVerificationWithRelations } from "@/lib/domains/leader-verification";
import { monthDisplay, dateDisplay } from "@/lib/shared/format";

// ─── Inline signature canvas (shared util) ────────────────────────────────────

function SignatureCanvas({
  onCapture,
  onCancel,
  showCancel,
}: {
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
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
    onCapture(canvasRef.current!.toDataURL("image/png"));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">วาดลายเซ็น</p>
      <canvas
        ref={canvasRef}
        className="w-full h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white touch-none cursor-crosshair"
        style={{ touchAction: "none" }}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="gap-1"
        >
          <RotateCcw className="h-3 w-3" /> ล้าง
        </Button>
        <Button size="sm" onClick={handleConfirm} className="flex-1 gap-1">
          <PenLine className="h-3 w-3" /> ใช้ลายเซ็นนี้
        </Button>
        {showCancel && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Single verification card ──────────────────────────────────────────────

type CardSigStep = "choose" | "draw" | "ready";

function VerificationCard({
  item,
  existingSignatureDataUrl,
  onVerified,
}: {
  item: LeaderVerificationWithRelations;
  existingSignatureDataUrl?: string | null;
  onVerified: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const initialStep: CardSigStep = existingSignatureDataUrl ? "choose" : "draw";
  const [sigStep, setSigStep] = useState<CardSigStep>(initialStep);
  const [capturedSig, setCapturedSig] = useState<string | null>(null);

  const isExpired =
    item.status === "PENDING" && new Date(item.expiresAt) < new Date();
  const isConfirmed = done || item.status === "CONFIRMED";
  const isSuperseded = item.status === "SUPERSEDED";

  const handleVerify = (sigDataUrl: string) => {
    startTransition(async () => {
      const res = await verifyAsLeader(
        item.claimRevisionId,
        item.revisionOffSiteWorkId,
        sigDataUrl,
      );
      if (!res.success) {
        toast.error("ยืนยันไม่สำเร็จ", { description: res.error });
        return;
      }
      setDone(true);
      toast.success("ยืนยันการออกปฏิบัติงานสำเร็จ");
      onVerified(item.id);
    });
  };

  const osw = item.offSiteWork;
  const claim = item.expenseClaim;

  // Which sig will be submitted
  const submitSig = capturedSig ?? existingSignatureDataUrl ?? null;

  const renderSignatureSection = () => {
    if (isConfirmed || isSuperseded || isExpired) return null;

    if (sigStep === "choose" && existingSignatureDataUrl) {
      return (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">
            ลายเซ็นของคุณ
          </p>
          <div className="rounded border bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingSignatureDataUrl}
              alt="ลายเซ็นที่บันทึกไว้"
              className="h-12 w-full object-contain"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setCapturedSig(existingSignatureDataUrl)}
            >
              <Star className="h-3 w-3" /> ใช้ลายเซ็นที่บันทึกไว้
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setSigStep("draw")}
            >
              <PenLine className="h-3 w-3" /> เซ็นใหม่
            </Button>
          </div>
        </div>
      );
    }

    if (capturedSig) {
      return (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            ลายเซ็นพร้อมใช้งาน
          </p>
          <div className="rounded border bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedSig}
              alt="ลายเซ็น"
              className="h-12 w-full object-contain"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setCapturedSig(null);
              setSigStep("draw");
            }}
          >
            <RotateCcw className="h-3 w-3" /> เซ็นใหม่
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
        onCancel={
          existingSignatureDataUrl ? () => setSigStep("choose") : undefined
        }
        showCancel={!!existingSignatureDataUrl}
      />
    );
  };

  return (
    <div
      className={`rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4 transition-all hover:border-primary/30 hover:bg-accent/30 ${
        done ? "opacity-60" : ""
      }`}
    >
      {/* Status badge row */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            {claim.claimant.firstName} {claim.claimant.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            เดือน {monthDisplay(claim.expenseMonth)}
          </p>
        </div>
        {isConfirmed ? (
          <Badge variant="default" className="shrink-0 bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            ยืนยันแล้ว
          </Badge>
        ) : isSuperseded ? (
          <Badge variant="outline" className="shrink-0">
            ยกเลิกจาก revision ใหม่
          </Badge>
        ) : isExpired ? (
          <Badge variant="destructive" className="shrink-0">
            หมดอายุ
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            รอยืนยัน
          </Badge>
        )}
      </div>
      {item.status === "CONFIRMED" && item.confirmedAt ? (
        <p className="text-xs text-emerald-700">
          ยืนยันเมื่อ {dateDisplay(item.confirmedAt)}
        </p>
      ) : item.status === "SUPERSEDED" && item.supersededAt ? (
        <p className="text-xs text-muted-foreground">
          ยกเลิกเมื่อ {dateDisplay(item.supersededAt)}
        </p>
      ) : null}

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-medium">วันที่ให้ยืนยัน</span>
          <strong>{item.confirmedDayCount} วัน · {item.amount.toLocaleString("th-TH")} บาท</strong>
        </div>
        <div className="space-y-1.5">
          {item.payloadSnapshot.dates.map((date) => (
            <div key={date.date} className="rounded-md bg-background px-3 py-2 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{dateDisplay(new Date(`${date.date}T00:00:00.000Z`))}</span>
                <span>{date.dayType === "TRAVEL" ? "เดินทาง" : "ปฏิบัติงาน"} · {date.dailyRate.toLocaleString("th-TH")} บาท</span>
              </div>
              {date.holidayName ? <p className="text-amber-700">{date.holidayName}</p> : null}
              {date.weSafeCodes.length > 0 ? <p className="break-all font-mono">We Safe: {date.weSafeCodes.join(", ")}</p> : null}
            </div>
          ))}
        </div>
      </div>

      {/* OSW details */}
      <div className="rounded-lg border bg-sky-50/60 dark:bg-sky-950/20 px-4 py-3 text-sm space-y-1.5">
        {osw.innerRefDocumentId && (
          <div className="flex gap-2 text-muted-foreground">
            <span className="w-24 shrink-0">เลขที่คำสั่ง</span>
            <span className="font-medium text-foreground font-mono text-xs">
              {osw.innerRefDocumentId}
            </span>
          </div>
        )}
        <div className="flex gap-2 text-muted-foreground">
          <span className="w-24 shrink-0">ช่วงวันที่</span>
          <span className="font-medium text-foreground">
            {dateDisplay(osw.startDate)} – {dateDisplay(osw.endDate)}
          </span>
        </div>
        {osw.location && (
          <div className="flex gap-2 text-muted-foreground">
            <span className="w-24 shrink-0">
              <MapPin className="inline mr-0.5 h-3 w-3" />
              สถานที่
            </span>
            <span className="font-medium text-foreground">{osw.location}</span>
          </div>
        )}
        {osw.objective && (
          <div className="flex gap-2 text-muted-foreground">
            <span className="w-24 shrink-0">วัตถุประสงค์</span>
            <span className="font-medium text-foreground">{osw.objective}</span>
          </div>
        )}
      </div>

      {/* Signature section */}
      {renderSignatureSection()}

      {/* Action */}
      {!isConfirmed && !isSuperseded && (
        <LoadingButton
          className="w-full"
          disabled={isPending || isExpired || submitSig === null}
          isLoading={isPending}
          loadingText="กำลังยืนยัน"
          onClick={() => submitSig && handleVerify(submitSig)}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          {isExpired
            ? "ลิงก์หมดอายุ — ติดต่อผู้ยื่น"
            : submitSig
            ? "ยืนยันการออกปฏิบัติงาน"
            : "กรุณาลงลายเซ็นก่อน"}
        </LoadingButton>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function PendingVerificationsClient({
  initialItems,
  existingSignatureDataUrl,
}: {
  initialItems: LeaderVerificationWithRelations[];
  existingSignatureDataUrl?: string | null;
}) {
  const items = initialItems;
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  const handleVerified = (id: string) => {
    setVerifiedIds((prev) => new Set([...prev, id]));
  };

  const pending = items.filter((i) => !verifiedIds.has(i.id) && !i.confirmedAt && i.status === "PENDING");
  const done = items.filter((i) => i.status === "CONFIRMED" || i.status === "SUPERSEDED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/40">
          <ClipboardList className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">คิวยืนยันการออกปฏิบัติงาน</h1>
          <p className="text-sm text-muted-foreground">
            รายการที่รอการยืนยันจากคุณในฐานะหัวหน้า
          </p>
        </div>
        {pending.length > 0 && (
          <Badge
            variant="destructive"
            className="ml-auto text-sm px-2.5 py-0.5"
          >
            {pending.length} รายการ
          </Badge>
        )}
      </div>

      {/* Pending list */}
      {pending.length === 0 && done.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3 shadow-sm">
          <ShieldCheck className="mx-auto h-12 w-12 text-green-400" />
          <p className="font-medium text-muted-foreground">
            ไม่มีรายการรอยืนยันในขณะนี้
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              {pending.map((item) => (
                <VerificationCard
                  key={item.id}
                  item={item}
                  existingSignatureDataUrl={existingSignatureDataUrl}
                  onVerified={handleVerified}
                />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none list-none flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                ประวัติการยืนยัน ({done.length} รายการ)
              </summary>
              <div className="mt-3 space-y-3 opacity-70">
                {done.map((item) => (
                  <VerificationCard
                    key={item.id}
                    item={item}
                    existingSignatureDataUrl={existingSignatureDataUrl}
                    onVerified={() => undefined}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
