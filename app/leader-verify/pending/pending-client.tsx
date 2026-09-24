"use client";

import { runServerAction } from "@/lib/deployment/client";
import { useWorkflowTransition as useTransition } from "@/lib/hooks/use-workflow-transition";

/**
 * PendingVerificationsClient
 *
 * Shows the authenticated leader's pending verification queue.
 * Groups documents for review while preserving per-order signatures.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  PenLine,
  RotateCcw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/workflow-ui/button";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { Badge } from "@/components/ui/badge";
import { getMyVerificationClaimDetail, verifyAsLeader } from "@/app/actions/leader-verify";
import type { LeaderClaimDetail, LeaderVerificationQueueItem } from "@/lib/domains/leader-verification";
import { monthDisplay, dateDisplay, toDateInputValue } from "@/lib/shared/format";
import { formatClaimDateRanges, normalizeClaimDates } from "@/lib/ui/claim-dates";
import { ClaimDatesCalendar } from "@/components/expense-claims/claim-dates-calendar";
import { ClaimDetailContent } from "@/components/expense-claims/claim-detail-content";
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogBody, DialogClose, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/workflow-ui/dialog";

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

// Dates are claim-level; this intersection describes a period, not an allocation.
function datesWithinOrder(dates: string[], work: LeaderVerificationQueueItem["offSiteWork"]) {
  const start = toDateInputValue(work.startDate);
  const end = toDateInputValue(work.endDate);
  return dates.filter((date) => date >= start && date <= end);
}

type CardSigStep = "choose" | "draw" | "ready";

function VerificationOrder({
  item,
  done,
  selectedDates,
  existingSignatureDataUrl,
  onVerified,
}: {
  item: LeaderVerificationQueueItem;
  done: boolean;
  selectedDates: string[];
  existingSignatureDataUrl?: string | null;
  onVerified: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const [sigStep, setSigStep] = useState<CardSigStep>(existingSignatureDataUrl ? "choose" : "draw");
  const [capturedSig, setCapturedSig] = useState<string | null>(null);
  const [isExpired, setExpired] = useState(() => new Date(item.expiresAt).getTime() <= Date.now());

  useEffect(() => {
    if (done) return;
    const updateExpiry = () => setExpired(new Date(item.expiresAt).getTime() <= Date.now());
    // A renewed link keeps the same verification ID; refresh its current state
    // as well as scheduling the next expiration deadline.
    const refresh = setTimeout(updateExpiry, 0);
    // Cap browser timers; production verification links expire after seven days.
    const delay = Math.min(Math.max(0, new Date(item.expiresAt).getTime() - Date.now() + 1), 2_147_483_647);
    const timer = setTimeout(updateExpiry, delay);
    return () => { clearTimeout(refresh); clearTimeout(timer); };
  }, [item.expiresAt, done]);

  const handleVerify = (sigDataUrl: string) => {
    if (inFlight.current || done) return;
    if (new Date(item.expiresAt).getTime() <= Date.now()) {
      setExpired(true);
      return;
    }
    inFlight.current = true;
    startTransition(async () => {
      try {
        const result = await runServerAction(() => verifyAsLeader(item.expenseClaimId, item.offSiteWorkId, sigDataUrl, item.id));
        if (result === undefined) return;
        if (!result.success) {
          toast.error("ยืนยันไม่สำเร็จ", { description: result.error });
          return;
        }
        toast.success("ยืนยันการออกปฏิบัติงานสำเร็จ");
        onVerified(item.id);
      } finally {
        inFlight.current = false;
      }
    });
  };

  const work = item.offSiteWork;
  const reference = work.innerRefDocumentId || work.id;
  const matchingDates = datesWithinOrder(selectedDates, work);
  // Drawing a replacement must not silently submit the previously saved signature.
  const submitSig = sigStep === "draw" ? null : capturedSig ?? existingSignatureDataUrl ?? null;

  return (
    <section aria-label={`คำสั่ง ${reference}`} className="grid gap-4 py-5 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-sm font-semibold">คำสั่ง {reference}</h3>
          <Badge variant={done ? "secondary" : isExpired ? "destructive" : "outline"}>
            {done ? <><CheckCircle2 className="mr-1 h-3 w-3" />ยืนยันแล้ว</> : isExpired ? "หมดอายุ" : "รอยืนยัน"}
          </Badge>
        </div>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">ช่วงปฏิบัติงาน</dt><dd>{dateDisplay(work.startDate)} – {dateDisplay(work.endDate)}</dd></div>
          {work.location && <div><dt className="text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />สถานที่</dt><dd className="break-words">{work.location}</dd></div>}
          {work.objective && <div><dt className="text-xs text-muted-foreground">วัตถุประสงค์</dt><dd className="whitespace-pre-wrap break-words">{work.objective}</dd></div>}
          <div>
            <dt className="text-xs text-muted-foreground">วันที่เบิกในช่วงคำสั่งนี้</dt>
            <dd className="mt-1 font-medium">{matchingDates.length ? `${formatClaimDateRanges(matchingDates)} · ${matchingDates.length} วัน` : selectedDates.length ? "ไม่มีวันเบิกตรงกับช่วงคำสั่งนี้" : "ไม่มีวันที่เบิกที่บันทึกไว้"}</dd>
          </div>
        </dl>
      </div>
      {!done && <div className="min-w-0 space-y-3">
        {!isExpired && <fieldset disabled={isPending} className="min-w-0 space-y-2" aria-label={`ลายเซ็นสำหรับคำสั่ง ${reference}`}>
          {sigStep === "draw" ? <div className={isPending ? "pointer-events-none" : undefined}>
            <SignatureCanvas
              onCapture={(dataUrl) => { setCapturedSig(dataUrl); setSigStep("ready"); }}
              onCancel={existingSignatureDataUrl ? () => { setCapturedSig(null); setSigStep("choose"); } : undefined}
              showCancel={!!existingSignatureDataUrl}
            />
          </div> : <>
            <p className="text-xs font-medium text-muted-foreground">{capturedSig ? "ลายเซ็นพร้อมใช้งาน" : "ลายเซ็นที่บันทึกไว้"}</p>
            <div className="rounded border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={submitSig ?? ""} alt="ลายเซ็นของคุณ" className="h-12 w-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2">
              {sigStep === "choose" && existingSignatureDataUrl && <Button variant="outline" size="sm" onClick={() => { setCapturedSig(existingSignatureDataUrl); setSigStep("ready"); }}><Star className="h-3 w-3" />ใช้ลายเซ็นที่บันทึกไว้</Button>}
              <Button variant="ghost" size="sm" onClick={() => { setCapturedSig(null); setSigStep("draw"); }}><PenLine className="h-3 w-3" />เซ็นใหม่</Button>
            </div>
          </>}
        </fieldset>}
        <LoadingButton
          className="w-full"
          disabled={isPending || isExpired || submitSig === null}
          isLoading={isPending}
          loadingText="กำลังยืนยัน"
          onClick={() => submitSig && handleVerify(submitSig)}
        >
          <ShieldCheck className="h-4 w-4" />
          {isExpired ? "หมดอายุ — ติดต่อผู้ยื่น" : submitSig ? "ยืนยันการออกปฏิบัติงาน" : "กรุณาลงลายเซ็นก่อน"}
        </LoadingButton>
      </div>}
    </section>
  );
}

function ClaimVerificationCard({ items, verifiedIds, existingSignatureDataUrl, onVerified, onOpenDetail }: {
  items: LeaderVerificationQueueItem[];
  verifiedIds: Set<string>;
  existingSignatureDataUrl?: string | null;
  onVerified: (id: string) => void;
  onOpenDetail: (claimId: string) => void;
}) {
  const claim = items[0].expenseClaim;
  const { dates } = normalizeClaimDates(claim.expenseMonth, claim.selectedDates, claim.countDates);
  const highlightedDates = [...new Set(items.flatMap((item) => datesWithinOrder(dates, item.offSiteWork)))];
  const isDone = (item: LeaderVerificationQueueItem) => verifiedIds.has(item.id) || !!item.verifiedAt;
  const remaining = items.filter((item) => !isDone(item)).length;
  const claimantName = `${claim.claimant.firstName} ${claim.claimant.lastName}`;

  return (
    <article aria-label={`${claimantName} · ${monthDisplay(claim.expenseMonth)}`} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <h2 className="break-words text-lg font-semibold">{claimantName}</h2>
            <p className="text-sm text-muted-foreground">เดือน {monthDisplay(claim.expenseMonth)}</p>
            <p className="break-all text-xs text-muted-foreground">เอกสาร {claim.id}</p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div><dt className="text-xs text-muted-foreground">จำนวนวันตามคำขอ</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{claim.countDates == null ? "—" : `${claim.countDates.toLocaleString("th-TH")} วัน`}</dd></div>
            <div><dt className="text-xs text-muted-foreground">ยอดเงินตามคำขอ</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{claim.amount == null ? "—" : `${claim.amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`}</dd></div>
          </dl>
          <p className="text-sm text-muted-foreground">{remaining ? `รอคุณยืนยัน ${remaining} จาก ${items.length} คำสั่ง` : "คุณยืนยันคำสั่งในเอกสารนี้ครบแล้ว"}</p>
          <Button variant="outline" onClick={() => onOpenDetail(claim.id)}><FileText className="h-4 w-4" />ดูรายละเอียดคำขอ</Button>
        </div>
        <div className="min-w-0">
          <ClaimDatesCalendar expenseMonth={claim.expenseMonth} selectedDates={claim.selectedDates} countDates={claim.countDates} highlightedDates={highlightedDates} compact />
        </div>
      </div>
      <div className="mt-5 border-t pt-5">
        <p className="mb-4 text-xs text-muted-foreground">คำสั่งที่คุณรับผิดชอบ · วันเบิกอาจอยู่ในหลายช่วงคำสั่ง ยอดรวมเอกสารนับแต่ละวันครั้งเดียว</p>
        <div className="divide-y">
          {items.map((item) => <VerificationOrder key={item.id} item={item} done={isDone(item)} selectedDates={dates} existingSignatureDataUrl={existingSignatureDataUrl} onVerified={onVerified} />)}
        </div>
      </div>
    </article>
  );
}

export function PendingVerificationsClient({ initialItems, existingSignatureDataUrl }: {
  initialItems: LeaderVerificationQueueItem[];
  existingSignatureDataUrl?: string | null;
}) {
  // Revalidation removes completed rows from server props. Keep this session's
  // successful items so partial groups and the completed section stay visible.
  const [verifiedItems, setVerifiedItems] = useState<Map<string, LeaderVerificationQueueItem>>(new Map());
  const [detailClaimId, setDetailClaimId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeaderClaimDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, []);

  const items = useMemo(() => {
    const merged = new Map(initialItems.map((item) => [item.id, item]));
    for (const [id, item] of verifiedItems) if (!merged.has(id)) merged.set(id, item);
    return [...merged.values()];
  }, [initialItems, verifiedItems]);
  const verifiedIds = new Set(verifiedItems.keys());
  const groups = useMemo(() => {
    const grouped = new Map<string, LeaderVerificationQueueItem[]>();
    for (const item of items) {
      const group = grouped.get(item.expenseClaimId) ?? [];
      group.push(item);
      grouped.set(item.expenseClaimId, group);
    }
    return [...grouped.values()].sort((a, b) =>
      Math.min(...a.map((item) => new Date(item.createdAt).getTime())) -
      Math.min(...b.map((item) => new Date(item.createdAt).getTime())),
    ).map((group) => group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }, [items]);
  const isDone = (item: LeaderVerificationQueueItem) => verifiedIds.has(item.id) || !!item.verifiedAt;
  const pendingGroups = groups.filter((items) => items.some((item) => !isDone(item)));
  const doneGroups = groups.filter((items) => items.every(isDone));
  const pendingCount = items.filter((item) => !isDone(item)).length;

  const openDetail = async (claimId: string) => {
    const currentRequest = ++requestId.current;
    setDetailClaimId(claimId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const result = await runServerAction(() => getMyVerificationClaimDetail(claimId));
      if (currentRequest !== requestId.current) return;
      if (result?.success) setDetail(result.data);
      else setDetailError(result === undefined ? "กรุณาโหลดหน้าใหม่เพื่อดูรายละเอียดคำขอ" : result.error);
    } catch {
      if (currentRequest === requestId.current) setDetailError("โหลดรายละเอียดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      if (currentRequest === requestId.current) setDetailLoading(false);
    }
  };
  const closeDetail = () => {
    requestId.current += 1;
    setDetailClaimId(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };
  const handleVerified = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item) setVerifiedItems((previous) => new Map(previous).set(id, item));
  };
  const renderGroup = (items: LeaderVerificationQueueItem[]) => <ClaimVerificationCard key={items[0].expenseClaimId} items={items} verifiedIds={verifiedIds} existingSignatureDataUrl={existingSignatureDataUrl} onVerified={handleVerified} onOpenDetail={(id) => void openDetail(id)} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-3">
        <ClipboardList className="mt-1 h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">คิวยืนยันการออกปฏิบัติงาน</h1>
          <p className="mt-1 text-sm text-muted-foreground">รายการที่รอการยืนยันจากคุณในฐานะหัวหน้า</p>
          <p className="mt-3 text-sm font-medium" aria-live="polite">{pendingGroups.length} เอกสาร · {pendingCount} รายการรอยืนยัน</p>
        </div>
      </header>
      {pendingGroups.length > 0 ? <div className="space-y-5">{pendingGroups.map(renderGroup)}</div> : <div className="rounded-xl border bg-card p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-primary" aria-hidden="true" />
        <p className="font-medium">ไม่มีรายการรอยืนยันในขณะนี้</p>
      </div>}
      {doneGroups.length > 0 && <details>
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4">ยืนยันแล้วในรอบนี้ ({doneGroups.length} เอกสาร)</summary>
        <div className="mt-4 space-y-5">{doneGroups.map(renderGroup)}</div>
      </details>}
      <Dialog open={detailClaimId !== null} presentation="drawer" onClose={closeDetail}>
        <DialogClose onClose={closeDetail} />
        <DialogHeader><DialogTitle>รายละเอียดคำขอ</DialogTitle><DialogDescription className="break-all">{detailClaimId}</DialogDescription></DialogHeader>
        <DialogBody>
          {detailLoading && <div role="status"><p className="mb-4 text-sm text-muted-foreground">กำลังโหลดรายละเอียดคำขอ…</p><DetailPanelSkeleton /></div>}
          {detailError && <div role="alert" className="space-y-3"><p className="text-sm">{detailError}</p><Button variant="outline" onClick={() => detailClaimId && void openDetail(detailClaimId)}>ลองใหม่</Button></div>}
          {detail && <ClaimDetailContent claim={detail} />}
        </DialogBody>
        <DialogFooter><Button variant="outline" onClick={closeDetail}>ปิด</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
