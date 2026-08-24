"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  Flag,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  markClaimSuspicious,
  passClaimIntoMonthlyRequest,
  rejectClaimFromRecheck,
  removeClaimFromDraftMonthlyRequest,
  resolveClaimSuspiciousFlag,
} from "@/app/actions/monthly-request-recheck";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type {
  MonthlyRequestRecheckDetail,
  RecheckClaimGroup,
  RecheckClaimRow,
  RecheckMetrics,
} from "@/lib/domains/monthly-request-recheck";
import { cn } from "@/lib/utils";

interface RecheckDetailClientProps {
  initialData: MonthlyRequestRecheckDetail;
  departmentId?: string;
}

type DialogState =
  | { kind: "view"; claim: RecheckClaimRow }
  | { kind: "pass"; claim: RecheckClaimRow }
  | { kind: "reject"; claim: RecheckClaimRow }
  | { kind: "flag"; claim: RecheckClaimRow }
  | { kind: "resolve"; claim: RecheckClaimRow; flagId: string }
  | { kind: "remove"; claim: RecheckClaimRow }
  | null;

const STATUS_LABELS: Record<RecheckClaimRow["status"], string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_LEADER_CONFIRMATION: "รอหัวหน้าชุดยืนยัน",
  READY_FOR_COLLECTION: "พร้อมรวบรวม",
  COLLECTED: "รวบรวมแล้ว",
  COMPLETED: "เสร็จสิ้น",
  REJECTED: "ตีกลับ",
  CANCELLED: "ยกเลิก",
};

const STATUS_VARIANTS: Record<RecheckClaimRow["status"], BadgeVariant> = {
  DRAFT: "secondary",
  PENDING_LEADER_CONFIRMATION: "warning",
  READY_FOR_COLLECTION: "success",
  COLLECTED: "default",
  COMPLETED: "success",
  REJECTED: "destructive",
  CANCELLED: "outline",
};

const GROUP_LABELS: Record<RecheckClaimGroup, string> = {
  ACTIVE: "คำขอปัจจุบัน",
  REJECTED: "คำขอที่ตีกลับ",
  DRAFT: "ฉบับร่าง",
  CANCELLED: "ยกเลิก",
};

const METRICS: Array<{ key: keyof RecheckMetrics; label: string }> = [
  { key: "participantCount", label: "ผู้เดินทาง" },
  { key: "submittedPeopleCount", label: "ส่งคำขอแล้ว" },
  { key: "notSubmittedPeopleCount", label: "ยังไม่ส่ง" },
  { key: "pendingLeaderClaimCount", label: "รอหัวหน้าชุด" },
  { key: "readyForCollectionClaimCount", label: "พร้อมรวบรวม" },
  { key: "collectedClaimCount", label: "รวบรวมแล้ว" },
  { key: "rejectedClaimCount", label: "ตีกลับ" },
  { key: "suspiciousClaimCount", label: "น่าสงสัย" },
];

function thaiDate(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function thaiDateTime(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function amount(value: string): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function claimName(claim: RecheckClaimRow): string {
  return `${claim.firstName} ${claim.lastName}`.trim();
}

interface ClaimTableProps {
  claims: RecheckClaimRow[];
  days: MonthlyRequestRecheckDetail["days"];
  onAction: (state: Exclude<DialogState, null>) => void;
}

function ClaimTable({ claims, days, onAction }: ClaimTableProps) {
  if (claims.length === 0) {
    return (
      <div className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
        ไม่มีรายการในกลุ่มนี้
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-20 min-w-56 border-r bg-muted px-3 py-2 text-left font-medium">
              ผู้ขอเบิก
            </th>
            <th className="min-w-32 border-r px-3 py-2 text-left font-medium">สถานะ</th>
            <th className="min-w-24 border-r px-3 py-2 text-center font-medium">วัน / เงิน</th>
            {days.map((day) => (
              <th
                key={day.isoDate}
                className={cn(
                  "w-9 min-w-9 border-r px-0.5 py-1 text-center font-medium",
                  day.isWeekend && "bg-amber-50 text-amber-800 dark:bg-amber-950/30",
                )}
                title={thaiDate(day.isoDate)}
              >
                <span className="block text-[11px]">{day.dayNumber}</span>
                <span className="block text-[9px]">{day.shortName}</span>
              </th>
            ))}
            <th className="sticky right-0 z-20 min-w-48 border-l bg-muted px-3 py-2 text-right font-medium">
              จัดการ
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {claims.map((claim) => {
            const dateMap = new Map(claim.dates.map((date) => [date.isoDate, date]));
            const differsFromMajority = Boolean(
              claim.dateComparison?.differsFromMajority,
            );
            const needsComparisonReview =
              differsFromMajority || claim.duplicateWeSafeDates.length > 0;
            return (
              <tr
                key={claim.id}
                className={cn(
                  "group hover:bg-muted/20",
                  needsComparisonReview && "bg-amber-50/40 dark:bg-amber-950/10",
                )}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r bg-background px-3 py-3 align-top group-hover:bg-muted/20",
                    needsComparisonReview && "bg-amber-50 dark:bg-amber-950/30",
                  )}
                >
                  <div className="font-medium text-foreground">{claimName(claim)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    รหัส {claim.employeeId.padStart(6, "0")} · {claim.positionShort}
                    {claim.positionLevel ? ` ${claim.positionLevel}` : ""}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {claim.departmentName}
                  </div>
                  {claim.openFlags.length > 0 && (
                    <Badge variant="destructive" className="mt-2 gap-1">
                      <Flag className="size-3" /> มีประเด็นเปิด
                    </Badge>
                  )}
                  {differsFromMajority && claim.dateComparison && (
                    <Badge variant="warning" className="mt-2 gap-1">
                      <CircleAlert className="size-3" /> ต่างจากกลุ่ม
                      {claim.dateComparison.missingMajorityDates.length > 0
                        ? ` −${claim.dateComparison.missingMajorityDates.length}`
                        : ""}
                      {claim.dateComparison.extraDates.length > 0
                        ? ` +${claim.dateComparison.extraDates.length}`
                        : ""}
                    </Badge>
                  )}
                  {claim.duplicateWeSafeDates.length > 0 && (
                    <Badge variant="outline" className="mt-2 gap-1 border-violet-300 text-violet-800">
                      WeSafe ซ้ำ {claim.duplicateWeSafeDates.length} วัน
                    </Badge>
                  )}
                </td>
                <td className="border-r px-3 py-3 align-top">
                  <Badge variant={STATUS_VARIANTS[claim.status]}>
                    {STATUS_LABELS[claim.status]}
                  </Badge>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    ยืนยัน {claim.verification.confirmed}/{claim.verification.total} ใบ
                  </div>
                  {claim.monthlyRequest && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {claim.monthlyRequest.batchNo === null
                        ? "MRC ฉบับร่าง"
                        : `MRC ชุด ${claim.monthlyRequest.batchNo}`} · {claim.monthlyRequest.status}
                    </div>
                  )}
                </td>
                <td className="border-r px-3 py-3 text-center align-top tabular-nums">
                  <div className="font-medium">{claim.totalDays} วัน</div>
                  <div className="mt-1 text-muted-foreground">{amount(claim.totalAmount)}</div>
                </td>
                {days.map((day) => {
                  const selected = dateMap.get(day.isoDate);
                  const weSafeMissing =
                    selected?.requiresWeSafe && !selected.hasWeSafeCode;
                  const title = selected
                    ? [
                        thaiDate(day.isoDate),
                        selected.dayType === "DUTY" ? "ปฏิบัติงาน" : "เดินทาง",
                        selected.holidayName,
                        selected.requiresWeSafe
                          ? selected.hasWeSafeCode
                            ? `WeSafe: ${selected.weSafeCodes.join(", ")}`
                            : "ขาดรหัส WeSafe"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : thaiDate(day.isoDate);
                  return (
                    <td
                      key={day.isoDate}
                      title={title}
                      className={cn(
                        "h-12 border-r p-1 text-center",
                        day.isWeekend && !selected && "bg-amber-50/50 dark:bg-amber-950/10",
                      )}
                    >
                      {selected && (
                        <span
                          className={cn(
                            "mx-auto flex size-7 items-center justify-center rounded-md bg-emerald-600 font-semibold text-white",
                            selected.holidayType !== "WORKDAY" && "bg-violet-600",
                            weSafeMissing && "ring-2 ring-red-500 ring-offset-1",
                          )}
                        >
                          {selected.requiresWeSafe ? "W" : "✓"}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td
                  className={cn(
                    "sticky right-0 z-10 border-l bg-background px-3 py-3 align-top group-hover:bg-muted/20",
                    needsComparisonReview && "bg-amber-50 dark:bg-amber-950/30",
                  )}
                >
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="ดูรายละเอียด"
                      onClick={() => onAction({ kind: "view", claim })}
                    >
                      <Eye />
                    </Button>
                    {claim.canPass && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-emerald-700 hover:text-emerald-800"
                        title="ผ่านและรวบรวมทั้งคำขอ"
                        onClick={() => onAction({ kind: "pass", claim })}
                      >
                        <Check />
                      </Button>
                    )}
                    {claim.canReject && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-red-700 hover:text-red-800"
                        title="ตีกลับให้แก้ไข"
                        onClick={() => onAction({ kind: "reject", claim })}
                      >
                        <X />
                      </Button>
                    )}
                    {claim.openFlags.length === 0 ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-amber-700 hover:text-amber-800"
                        title="ทำเครื่องหมายน่าสงสัย"
                        onClick={() => onAction({ kind: "flag", claim })}
                      >
                        <Flag />
                      </Button>
                    ) : (
                      claim.openFlags.map((flag) => (
                        <Button
                          key={flag.id}
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-blue-700 hover:text-blue-800"
                          title="ปิดประเด็นน่าสงสัย"
                          onClick={() =>
                            onAction({ kind: "resolve", claim, flagId: flag.id })
                          }
                        >
                          <RotateCcw />
                        </Button>
                      ))
                    )}
                    {claim.canRemove && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-red-700 hover:text-red-800"
                        title="นำออกจาก monthly request ฉบับร่าง"
                        onClick={() => onAction({ kind: "remove", claim })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  {!claim.canPass && claim.group === "ACTIVE" && (
                    <div className="mt-2 max-w-48 text-right text-[10px] leading-4 text-muted-foreground">
                      {claim.passBlockedReasons.join(" · ")}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailDialog({ state, onClose }: { state: Extract<DialogState, { kind: "view" }>; onClose: () => void }) {
  const { claim } = state;
  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogClose onClose={onClose} />
      <DialogHeader>
        <DialogTitle>{claimName(claim)}</DialogTitle>
        <DialogDescription>
          คำขอ {claim.id} · revision {claim.revisionNo}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-5 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-muted-foreground">รหัสพนักงาน</dt><dd>{claim.employeeId.padStart(6, "0")}</dd></div>
          <div><dt className="text-muted-foreground">ตำแหน่ง</dt><dd>{claim.positionShort} {claim.positionLevel}</dd></div>
          <div><dt className="text-muted-foreground">หน่วยงาน</dt><dd>{claim.departmentName}</dd></div>
          <div><dt className="text-muted-foreground">ยอดเบิก</dt><dd>{claim.totalDays} วัน · {amount(claim.totalAmount)} บาท</dd></div>
          <div><dt className="text-muted-foreground">การยืนยันหัวหน้าชุด</dt><dd>{claim.verification.confirmed}/{claim.verification.total} ใบ</dd></div>
          <div><dt className="text-muted-foreground">ใบนำตัวที่อ้างอิง</dt><dd>{claim.linkedOffSiteWorkCount} ใบ</dd></div>
        </dl>
        <div>
          <p className="text-muted-foreground">วันที่เบิกในใบนำตัวนี้</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {claim.dates.length > 0 ? claim.dates.map((date) => (
              <Badge key={date.isoDate} variant={date.requiresWeSafe && !date.hasWeSafeCode ? "destructive" : "outline"}>
                {thaiDate(date.isoDate)}
                {date.requiresWeSafe
                  ? date.weSafeCodes.length > 0
                    ? ` · WeSafe ${date.weSafeCodes.join(", ")}`
                    : " · ขาด WeSafe"
                  : ""}
              </Badge>
            )) : <span className="text-muted-foreground">ไม่มีวันที่</span>}
          </div>
        </div>
        {claim.remark && <div><p className="text-muted-foreground">หมายเหตุ</p><p className="mt-1 whitespace-pre-wrap">{claim.remark}</p></div>}
        {claim.dateComparison?.differsFromMajority && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
            <p className="font-medium">วันที่ต่างจากรูปแบบของคนส่วนใหญ่</p>
            {claim.dateComparison.missingMajorityDates.length > 0 && (
              <p className="mt-1">
                วันที่กลุ่มส่วนใหญ่เบิกแต่รายการนี้ไม่มี: {claim.dateComparison.missingMajorityDates.map(thaiDate).join(", ")}
              </p>
            )}
            {claim.dateComparison.extraDates.length > 0 && (
              <p className="mt-1">
                วันที่รายการนี้เบิกเพิ่มจากกลุ่ม: {claim.dateComparison.extraDates.map(thaiDate).join(", ")}
              </p>
            )}
          </div>
        )}
        {claim.duplicateWeSafeDates.length > 0 && (
          <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-950">
            <p className="font-medium">พบรหัส WeSafe ซ้ำในวันเดียวกัน</p>
            <p className="mt-1">{claim.duplicateWeSafeDates.map(thaiDate).join(", ")}</p>
          </div>
        )}
        {claim.rejectionReason && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800"><p className="font-medium">เหตุผลที่ตีกลับ</p><p className="mt-1">{claim.rejectionReason}</p></div>}
        {claim.openFlags.map((flag) => (
          <div key={flag.id} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <p className="font-medium">ประเด็นที่ยังเปิด</p>
            <p className="mt-1">{flag.note}</p>
            <p className="mt-2 text-xs">{flag.openedByName} · {thaiDateTime(flag.openedAt)}</p>
          </div>
        ))}
        {claim.resolvedFlags.length > 0 && (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer font-medium">ประวัติประเด็นที่ปิดแล้ว ({claim.resolvedFlags.length})</summary>
            <div className="mt-3 space-y-3">
              {claim.resolvedFlags.map((flag) => (
                <div key={flag.id} className="text-xs">
                  <p>{flag.note}</p>
                  <p className="mt-1 text-muted-foreground">ผลตรวจ: {flag.resolutionNote || "-"} · {flag.resolvedByName || "-"}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>ปิด</Button>
      </DialogFooter>
    </Dialog>
  );
}

export function RecheckDetailClient({
  initialData,
  departmentId,
}: RecheckDetailClientProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const groups = useMemo(
    () =>
      (["ACTIVE", "REJECTED", "DRAFT", "CANCELLED"] as const).map((group) => ({
        group,
        claims: initialData.claims.filter((claim) => claim.group === group),
      })),
    [initialData.claims],
  );
  const backQuery = new URLSearchParams({ month: initialData.month });
  if (departmentId) backQuery.set("departmentId", departmentId);

  function openDialog(next: Exclude<DialogState, null>): void {
    setNote("");
    setDialog(next);
  }

  async function submitAction(): Promise<void> {
    if (!dialog || dialog.kind === "view") return;
    setPending(true);
    try {
      let result;
      if (dialog.kind === "pass") {
        result = await passClaimIntoMonthlyRequest(
          dialog.claim.id,
          dialog.claim.revisionNo,
          initialData.month,
          initialData.offSiteWork.id,
        );
      } else if (dialog.kind === "reject") {
        result = await rejectClaimFromRecheck(
          { claimId: dialog.claim.id, reason: note, month: initialData.month },
          initialData.offSiteWork.id,
        );
      } else if (dialog.kind === "flag") {
        result = await markClaimSuspicious(
          { claimId: dialog.claim.id, note, month: initialData.month },
          initialData.offSiteWork.id,
        );
      } else if (dialog.kind === "resolve") {
        result = await resolveClaimSuspiciousFlag(
          { flagId: dialog.flagId, resolutionNote: note, month: initialData.month },
          initialData.offSiteWork.id,
        );
      } else {
        result = await removeClaimFromDraftMonthlyRequest(
          { claimId: dialog.claim.id, reason: note || undefined, month: initialData.month },
          initialData.offSiteWork.id,
        );
      }

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        dialog.kind === "pass"
          ? result.data.batchNo === null || result.data.batchNo === undefined
            ? "รวบรวมเข้า monthly request ฉบับร่างแล้ว"
            : `รวบรวมเข้า monthly request ชุด ${result.data.batchNo} แล้ว`
          : "บันทึกเรียบร้อยแล้ว",
      );
      setDialog(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const actionCopy = dialog && dialog.kind !== "view"
    ? {
        pass: { title: "ผ่านและรวบรวมทั้งคำขอ", description: `ระบบจะรวบรวมคำขอของ ${claimName(dialog.claim)} ทั้งฉบับ ซึ่งอ้างอิง ${dialog.claim.linkedOffSiteWorkCount} ใบนำตัว`, button: "ผ่านและรวบรวม" },
        reject: { title: "ตีกลับให้ผู้ขอแก้ไข", description: "ผู้ขอต้องแก้ไข ส่งใหม่ และให้หัวหน้าชุดยืนยันใหม่ทั้งหมด", button: "ยืนยันตีกลับ" },
        flag: { title: "ทำเครื่องหมายน่าสงสัย", description: "คำขอจะผ่านเพื่อรวบรวมไม่ได้จนกว่าจะปิดประเด็นนี้", button: "บันทึกประเด็น" },
        resolve: { title: "ปิดประเด็นน่าสงสัย", description: "ระบุผลการตรวจหรือติดต่อก่อนอนุญาตให้รวบรวม", button: "ปิดประเด็น" },
        remove: { title: "นำออกจาก monthly request ฉบับร่าง", description: "คำขอจะกลับไปรอการรวบรวมและยังสามารถตรวจใหม่ได้", button: "ยืนยันนำออก" },
      }[dialog.kind]
    : null;

  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
          <Link href={`/monthly-request-recheck?${backQuery}`}>
            <ArrowLeft className="size-4" /> กลับหน้าภาพรวม
          </Link>
        </Button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {initialData.offSiteWork.referenceNo}
              </h1>
              <Badge variant="outline">
                {thaiDate(initialData.offSiteWork.startDate)} – {thaiDate(initialData.offSiteWork.endDate)}
              </Badge>
              {initialData.offSiteWork.archived && (
                <Badge variant="secondary">ใบนำตัวเก็บถาวร</Badge>
              )}
            </div>
            {initialData.offSiteWork.objective && (
              <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
                {initialData.offSiteWork.objective}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              วันที่สีเขียว/ม่วงคือวันที่เบิกในใบนำตัวนี้ · W คือวันที่ต้องมี WeSafe (วงแดง = ยังขาดรหัส)
            </p>
            {initialData.datePatternSummary && (
              <div className="mt-3 flex max-w-4xl gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  รูปแบบวันที่หลักพบใน {initialData.datePatternSummary.majorityClaimCount} จาก {initialData.datePatternSummary.comparableClaimCount} คำขอ
                  ({initialData.datePatternSummary.majorityDates.length} วัน) — ระบบไฮไลต์แถวที่ต่างไว้ด้านบนเพื่อช่วยตรวจ แต่ไม่ตัดสินหรือทำเครื่องหมายน่าสงสัยแทน Collector
                </span>
              </div>
            )}
          </div>
          <Badge variant="secondary" className="self-start">
            ผู้เดินทาง {initialData.offSiteWork.participantCount} คน
          </Badge>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {METRICS.map((metric) => (
          <Card key={metric.key} className="gap-1 py-3">
            <CardContent className="px-3">
              <p className="text-[11px] text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {initialData.metrics[metric.key].toLocaleString("th-TH")}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="space-y-4">
        {groups.map(({ group, claims }) => {
          const collapsible = group === "DRAFT" || group === "CANCELLED";
          const heading = (
            <div className="flex items-center gap-2 px-5 py-4">
              {collapsible && <ChevronDown className="size-4 transition-transform group-open:rotate-180" />}
              <h2 className="font-semibold">{GROUP_LABELS[group]}</h2>
              <Badge variant="secondary">{claims.length}</Badge>
            </div>
          );
          if (collapsible) {
            return (
              <details key={group} className="group overflow-hidden rounded-xl border bg-card">
                <summary className="cursor-pointer list-none">{heading}</summary>
                <ClaimTable claims={claims} days={initialData.days} onAction={openDialog} />
              </details>
            );
          }
          return (
            <Card key={group} className="gap-0 overflow-hidden py-0">
              {heading}
              <ClaimTable claims={claims} days={initialData.days} onAction={openDialog} />
            </Card>
          );
        })}
      </div>

      {dialog?.kind === "view" && (
        <DetailDialog state={dialog} onClose={() => setDialog(null)} />
      )}
      {dialog && dialog.kind !== "view" && actionCopy && (
        <Dialog
          open
          onClose={() => !pending && setDialog(null)}
          className={dialog.kind === "pass" ? "max-w-2xl" : undefined}
        >
          <DialogClose onClose={() => setDialog(null)} disabled={pending} />
          <DialogHeader>
            <DialogTitle>{actionCopy.title}</DialogTitle>
            <DialogDescription>{actionCopy.description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{claimName(dialog.claim)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {dialog.claim.employeeId.padStart(6, "0")} · {dialog.claim.totalDays} วัน · {amount(dialog.claim.totalAmount)} บาท
              </div>
            </div>
            {dialog.kind === "pass" && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">ใบนำตัวทั้งหมดในคำขอนี้</p>
                  <div className="mt-2 space-y-1.5">
                    {dialog.claim.linkedOffSiteWorks.map((offSiteWork) => (
                      <div
                        key={offSiteWork.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <span className="truncate">{offSiteWork.referenceNo}</span>
                        <Badge
                          variant={
                            offSiteWork.verificationStatus === "CONFIRMED"
                              ? "success"
                              : "warning"
                          }
                        >
                          {offSiteWork.verificationStatus === "CONFIRMED"
                            ? "ยืนยันแล้ว"
                            : "ยังไม่ยืนยัน"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium">วันที่เบิกทั้งหมด</p>
                  <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">
                    {dialog.claim.allDates.map((date) => (
                      <div
                        key={`${date.offSiteWorkId}-${date.isoDate}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1.5 text-xs odd:bg-muted/40"
                      >
                        <span>
                          {thaiDate(date.isoDate)} · {date.offSiteWorkReferenceNo}
                        </span>
                        {date.requiresWeSafe && (
                          <span
                            className={cn(
                              "text-muted-foreground",
                              date.weSafeCodes.length === 0 && "font-medium text-red-700",
                            )}
                          >
                            {date.weSafeCodes.length > 0
                              ? `WeSafe ${date.weSafeCodes.join(", ")}`
                              : "ขาด WeSafe"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {dialog.kind !== "pass" && (
              <label className="block space-y-2 text-sm font-medium">
                <span>
                  {dialog.kind === "reject"
                    ? "เหตุผลที่ต้องแก้ไข"
                    : dialog.kind === "flag"
                      ? "ประเด็นที่ต้องตรวจสอบ"
                      : dialog.kind === "resolve"
                        ? "ผลการตรวจสอบ"
                        : "เหตุผล (ไม่บังคับ)"}
                </span>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={pending}
                  minLength={dialog.kind === "remove" ? undefined : 3}
                  placeholder="ระบุรายละเอียดให้ตรวจสอบย้อนหลังได้"
                />
              </label>
            )}
            {dialog.kind === "pass" && dialog.claim.openFlags.length > 0 && (
              <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                ยังมีประเด็นน่าสงสัยที่ต้องปิดก่อน
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant={dialog.kind === "reject" || dialog.kind === "remove" ? "destructive" : "default"}
              disabled={pending || (dialog.kind !== "pass" && dialog.kind !== "remove" && note.trim().length < 3)}
              onClick={submitAction}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {actionCopy.button}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
