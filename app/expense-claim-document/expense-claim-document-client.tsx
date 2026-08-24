"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createExpenseClaimDocument,
  deleteExpenseClaimDocument,
  getExpenseClaimDocument,
  listEligibleOffSiteWorksForClaim,
  listExpenseClaimDocuments,
  resolveHolidayDatesForClaim,
  submitDraftExpenseClaimDocument,
  updateExpenseClaimDocument,
} from "@/app/actions/expense-claim-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Textarea } from "@/components/ui/textarea";
import type {
  ClaimWorkDateInput,
  EligibleOffSiteWorkOption,
  ExpenseClaimDocumentWithRelations,
} from "@/lib/domains/expense-claim-document";
import {
  CLAIM_DAILY_RATE,
  deriveWorkDayType,
} from "@/lib/domains/expense-claim-document/validation";
import type { HolidayResolution } from "@/lib/domains/holiday-calendar";
import { claimStatusVariant } from "@/lib/shared/claim-status";
import type { ExpenseClaimStatus, Pagination } from "@/lib/shared/types";
import { LeaderVerificationSection } from "./leader-verification-section";

interface ExpenseClaimDocumentClientProps {
  initialItems: ExpenseClaimDocumentWithRelations[];
  initialPagination: Pagination | null;
  initialViewId: string | null;
  currentUserDisplayName: string;
  currentUserClaimantPositionAtSubmission: string;
}

interface WorkDateDraft {
  date: string;
  offSiteWorkId: string;
  weSafeCodes: string[];
}

const PAGE_SIZE = 20;
const RATE = CLAIM_DAILY_RATE;

const STATUS_LABEL: Record<ExpenseClaimStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_LEADER_CONFIRMATION: "รอหัวหน้าชุดยืนยัน",
  READY_FOR_COLLECTION: "พร้อมรวบรวม",
  COLLECTED: "รวบรวมแล้ว",
  COMPLETED: "เสร็จสิ้น",
  REJECTED: "ให้แก้ไข",
  CANCELLED: "ยกเลิก",
};

function isoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function currentMonth(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month
    ? `${year}-${month}`
    : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value: Date | string): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function formatDate(value: Date | string): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function dateRangeForMonth(month: string): { start: string; end: string } {
  const [year, monthNo] = month.split("-").map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, monthNo, 0)).toISOString().slice(0, 10),
  };
}

function enumerateDates(start: string, end: string): string[] {
  const output: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    output.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
}

function oswLabel(option: EligibleOffSiteWorkOption): string {
  return option.innerRefDocumentId?.trim() || option.id;
}

export function ExpenseClaimDocumentClient({
  initialItems,
  initialPagination,
  initialViewId,
  currentUserDisplayName,
  currentUserClaimantPositionAtSubmission,
}: ExpenseClaimDocumentClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<ExpenseClaimDocumentWithRelations | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseClaimDocumentWithRelations | null>(null);
  const [expenseMonth, setExpenseMonth] = useState(currentMonth());
  const [remark, setRemark] = useState("");
  const [eligible, setEligible] = useState<EligibleOffSiteWorkOption[]>([]);
  const [selectedOswIds, setSelectedOswIds] = useState<string[]>([]);
  const [workDates, setWorkDates] = useState<WorkDateDraft[]>([]);
  const [holidays, setHolidays] = useState<Record<string, HolidayResolution>>({});
  const [cancelTarget, setCancelTarget] = useState<ExpenseClaimDocumentWithRelations | null>(null);

  const loadEligible = useCallback(async (
    month: string,
    seedClaim?: ExpenseClaimDocumentWithRelations,
  ) => {
    const result = await listEligibleOffSiteWorksForClaim(month);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setEligible(result.data);
    if (seedClaim) {
      const byId = new Map(result.data.map((item) => [item.id, item]));
      const replacementByOldId = new Map(
        result.data
          .filter((item) => item.supersedesId)
          .map((item) => [item.supersedesId!, item]),
      );
      const remapped = seedClaim.currentRevision.workDates.flatMap((item) => {
        const option =
          byId.get(item.offSiteWorkId) ??
          replacementByOldId.get(item.offSiteWorkId);
        if (
          !option ||
          isoDate(option.startDate) > item.date ||
          isoDate(option.endDate) < item.date
        ) {
          return [];
        }
        return [{
          date: item.date,
          offSiteWorkId: option.id,
          weSafeCodes: [...item.weSafeCodes],
        }];
      });
      setWorkDates(remapped);
      setSelectedOswIds([
        ...new Set(remapped.map((item) => item.offSiteWorkId)),
      ]);
      const didRemap = remapped.some((item) => {
        const old = seedClaim.currentRevision.workDates.find(
          (candidate) => candidate.date === item.date,
        );
        return old?.offSiteWorkId !== item.offSiteWorkId;
      });
      if (didRemap) {
        toast.info(
          "ระบบเปลี่ยนใบนำตัวหลักเป็นฉบับทดแทนแล้ว กรุณาตรวจวันที่อีกครั้ง",
        );
      }
    }
  }, []);

  const selectedOptions = useMemo(
    () => eligible.filter((item) => selectedOswIds.includes(item.id)),
    [eligible, selectedOswIds],
  );

  const datePool = useMemo(() => {
    if (!expenseMonth) return [];
    const monthRange = dateRangeForMonth(expenseMonth);
    const values = new Set<string>();
    for (const option of selectedOptions) {
      const start = isoDate(option.startDate) > monthRange.start
        ? isoDate(option.startDate)
        : monthRange.start;
      const end = isoDate(option.endDate) < monthRange.end
        ? isoDate(option.endDate)
        : monthRange.end;
      if (start <= end) enumerateDates(start, end).forEach((date) => values.add(date));
    }
    return [...values].sort();
  }, [expenseMonth, selectedOptions]);

  useEffect(() => {
    let active = true;
    if (datePool.length === 0) {
      setHolidays({});
      return () => {
        active = false;
      };
    }
    void resolveHolidayDatesForClaim(datePool).then((result) => {
      if (!active || !result.success) return;
      setHolidays(
        Object.fromEntries(result.data.map((item) => [item.date, item])),
      );
    });
    return () => {
      active = false;
    };
  }, [datePool]);

  const refreshList = useCallback(async (page = pagination?.page ?? 1) => {
    const result = await listExpenseClaimDocuments({
      page,
      pageSize: PAGE_SIZE,
      search: search.trim() || undefined,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setItems(result.data.data);
    setPagination(result.data.pagination);
  }, [pagination?.page, search]);

  const showDetail = useCallback(async (id: string) => {
    const result = await getExpenseClaimDocument(id);
    if (result.success) setDetail(result.data);
    else toast.error(result.error);
  }, []);

  useEffect(() => {
    if (initialViewId) void showDetail(initialViewId);
  }, [initialViewId, showDetail]);

  const openCreate = () => {
    const month = currentMonth();
    setEditing(null);
    setExpenseMonth(month);
    setRemark("");
    setSelectedOswIds([]);
    setWorkDates([]);
    setFormOpen(true);
    void loadEligible(month);
  };

  const openEdit = (claim: ExpenseClaimDocumentWithRelations) => {
    const month = isoDate(claim.expenseMonth).slice(0, 7);
    setEditing(claim);
    setExpenseMonth(month);
    setRemark(claim.currentRevision.remark ?? "");
    setSelectedOswIds([]);
    setWorkDates([]);
    setFormOpen(true);
    void loadEligible(month, claim);
  };

  const toggleOsw = (id: string) => {
    setSelectedOswIds((previous) => {
      if (!previous.includes(id)) return [...previous, id];
      setWorkDates((dates) => dates.filter((item) => item.offSiteWorkId !== id));
      return previous.filter((item) => item !== id);
    });
  };

  const matchingOptions = (date: string) =>
    selectedOptions.filter(
      (option) => isoDate(option.startDate) <= date && isoDate(option.endDate) >= date,
    );

  const setDateSelected = (date: string, selected: boolean) => {
    setWorkDates((previous) => {
      if (!selected) return previous.filter((item) => item.date !== date);
      if (previous.some((item) => item.date === date)) return previous;
      const primary = matchingOptions(date)[0];
      return primary
        ? [...previous, { date, offSiteWorkId: primary.id, weSafeCodes: [] }].sort(
            (a, b) => a.date.localeCompare(b.date),
          )
        : previous;
    });
  };

  const updateWorkDate = (date: string, change: Partial<WorkDateDraft>) => {
    setWorkDates((previous) =>
      previous.map((item) => (item.date === date ? { ...item, ...change } : item)),
    );
  };

  const setCode = (date: string, index: number, value: string) => {
    const current = workDates.find((item) => item.date === date);
    if (!current) return;
    const codes = [...current.weSafeCodes];
    codes[index] = value;
    updateWorkDate(date, { weSafeCodes: codes });
  };

  const addCode = (date: string) => {
    const current = workDates.find((item) => item.date === date);
    if (!current) return;
    const year = date.slice(0, 4);
    updateWorkDate(date, { weSafeCodes: [...current.weSafeCodes, `WSZ${year}`] });
  };

  const removeCode = (date: string, index: number) => {
    const current = workDates.find((item) => item.date === date);
    if (!current) return;
    updateWorkDate(date, {
      weSafeCodes: current.weSafeCodes.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const save = (submitAfterSave: boolean) => {
    startTransition(async () => {
      const payloadDates: ClaimWorkDateInput[] = workDates.map((item) => ({
        date: item.date,
        offSiteWorkId: item.offSiteWorkId,
        weSafeCodes: item.weSafeCodes.filter((code) => code.trim().length > 0),
      }));
      const saved = editing
        ? await updateExpenseClaimDocument(editing.id, {
            expenseMonth: `${expenseMonth}-01`,
            remark,
            workDates: payloadDates,
          })
        : await createExpenseClaimDocument({
            expenseMonth: `${expenseMonth}-01`,
            remark,
            workDates: payloadDates,
          });
      if (!saved.success) {
        toast.error(saved.error);
        return;
      }
      if (submitAfterSave) {
        const submitted = await submitDraftExpenseClaimDocument(saved.data.id);
        if (!submitted.success) {
          toast.error("บันทึกฉบับร่างแล้ว แต่ยังส่งไม่ได้", {
            description: submitted.error,
          });
          const draft = await getExpenseClaimDocument(saved.data.id);
          if (draft.success) setDetail(draft.data);
          setFormOpen(false);
          await refreshList();
          return;
        }
        toast.success("ส่งคำขอให้หัวหน้าชุดยืนยันแล้ว");
      } else {
        toast.success("บันทึกฉบับร่างแล้ว");
      }
      const fresh = await getExpenseClaimDocument(saved.data.id);
      if (fresh.success) setDetail(fresh.data);
      setFormOpen(false);
      await refreshList();
      router.refresh();
    });
  };

  const cancelClaim = () => {
    if (!cancelTarget) return;
    startTransition(async () => {
      const result = await deleteExpenseClaimDocument(cancelTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("ยกเลิกคำขอแล้ว");
      setCancelTarget(null);
      if (detail?.id === cancelTarget.id) setDetail(null);
      await refreshList();
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">คำขอเบิกค่าตอบแทนรายเดือน</h2>
          <p className="text-sm text-muted-foreground">
            {RATE} บาทต่อวัน · เลือกใบนำตัวหลักให้แต่ละวันที่ขอเบิก
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> สร้างคำขอ
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(() => refreshList(1));
        }}
      >
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="ค้นหาเลขคำขอหรือชื่อผู้ขอ" />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>ค้นหา</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          message="ยังไม่มีคำขอเบิก — กด “สร้างคำขอ” เพื่อเริ่มฉบับร่าง"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((claim) => (
            <Card key={claim.id} className="gap-4 py-4">
              <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{formatMonth(claim.expenseMonth)}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {claim.claimant.firstName} {claim.claimant.lastName}
                    </p>
                  </div>
                  <Badge variant={claimStatusVariant(claim.status)}>{STATUS_LABEL[claim.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-4">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">จำนวนวัน</span>
                  <span className="text-right font-medium">{claim.countDates} วัน</span>
                  <span className="text-muted-foreground">ยอดรวม</span>
                  <span className="text-right font-medium">{claim.amount.toLocaleString("th-TH")} บาท</span>
                  <span className="text-muted-foreground">Revision</span>
                  <span className="text-right">{claim.currentRevisionNo}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void showDetail(claim.id)}>
                    <Eye className="h-4 w-4" /> ดูรายละเอียด
                  </Button>
                  {!(["COLLECTED", "COMPLETED", "CANCELLED"] as ExpenseClaimStatus[]).includes(claim.status) ? (
                    <Button size="sm" variant="outline" onClick={() => openEdit(claim)}>
                      <Pencil className="h-4 w-4" /> แก้ไข
                    </Button>
                  ) : null}
                  {!(["COLLECTED", "COMPLETED", "CANCELLED"] as ExpenseClaimStatus[]).includes(claim.status) ? (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelTarget(claim)}>
                      <Trash2 className="h-4 w-4" /> ยกเลิก
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination ? (
        <PaginationControls
          pagination={pagination}
          isPending={isPending}
          onPrevious={() => startTransition(() => refreshList(pagination.page - 1))}
          onNext={() => startTransition(() => refreshList(pagination.page + 1))}
        />
      ) : null}

      <Dialog open={formOpen} onClose={() => !isPending && setFormOpen(false)} className="max-w-5xl">
        <DialogClose onClose={() => setFormOpen(false)} />
        <DialogHeader>
          <DialogTitle>{editing ? `แก้ไขคำขอ Revision ${editing.currentRevisionNo}` : "สร้างคำขอเบิก"}</DialogTitle>
          <DialogDescription>
            {currentUserDisplayName} · {currentUserClaimantPositionAtSubmission}
            {editing && editing.status !== "DRAFT" ? " · การแก้ไขจะสร้าง revision ใหม่และยกเลิกการยืนยันเดิม" : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="claim-month">เดือนที่เบิก</Label>
              <Input
                id="claim-month"
                type="month"
                value={expenseMonth}
                disabled={Boolean(editing)}
                onChange={(event) => {
                  setExpenseMonth(event.target.value);
                  setSelectedOswIds([]);
                  setWorkDates([]);
                  void loadEligible(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>อัตราและยอดรวม</Label>
              <div className="rounded-md border px-3 py-2 text-sm">
                {workDates.length} วัน × {RATE} บาท = <strong>{(workDates.length * RATE).toLocaleString("th-TH")} บาท</strong>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="font-medium">1. เลือกใบนำตัวที่เกี่ยวข้อง</h3>
              <p className="text-xs text-muted-foreground">แสดงเฉพาะใบนำตัวที่มีชื่อคุณเป็นผู้เดินทางในเดือนนี้</p>
            </div>
            {eligible.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">ไม่พบใบนำตัวที่ใช้เบิกได้ในเดือนนี้</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {eligible.map((option) => (
                  <label key={option.id} className="flex cursor-pointer gap-3 rounded-lg border p-3">
                    <input type="checkbox" className="mt-1" checked={selectedOswIds.includes(option.id)} onChange={() => toggleOsw(option.id)} />
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">{oswLabel(option)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(option.startDate)} – {formatDate(option.endDate)}
                        {option.location ? ` · ${option.location}` : ""}
                      </span>
                      {!option.hasLeader ? <span className="text-xs text-destructive">ยังไม่มีหัวหน้าชุด (บันทึกร่างได้ แต่ส่งไม่ได้)</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="font-medium">2. เลือกวันและใบนำตัวหลัก</h3>
              <p className="text-xs text-muted-foreground">หนึ่งวันเลือกได้เพียงหนึ่งใบนำตัวหลัก ระบบคำนวณวันเดินทางจากวันเริ่ม/สิ้นสุดเอง</p>
            </div>
            {datePool.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">เลือกใบนำตัวก่อนเพื่อแสดงวันที่</p>
            ) : (
              <div className="space-y-2">
                {datePool.map((date) => {
                  const selected = workDates.find((item) => item.date === date);
                  const options = matchingOptions(date);
                  const primary = options.find((item) => item.id === selected?.offSiteWorkId);
                  const dayType = primary
                    ? deriveWorkDayType(date, isoDate(primary.startDate), isoDate(primary.endDate))
                    : "DUTY";
                  const holiday = holidays[date];
                  const requiresCode = dayType === "TRAVEL" || holiday?.holidayType === "WEEKEND" || holiday?.holidayType === "PUBLIC_HOLIDAY";
                  return (
                    <div key={date} className={selected ? "rounded-lg border border-primary/30 bg-primary/5 p-3" : "rounded-lg border p-3"}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="flex min-w-48 items-center gap-2 text-sm font-medium">
                          <input type="checkbox" checked={Boolean(selected)} onChange={(event) => setDateSelected(date, event.target.checked)} />
                          {formatDate(date)}
                        </label>
                        {selected ? (
                          <>
                            <select
                              className="h-9 min-w-64 flex-1 rounded-md border bg-background px-3 text-sm"
                              value={selected.offSiteWorkId}
                              onChange={(event) => updateWorkDate(date, { offSiteWorkId: event.target.value })}
                            >
                              {options.map((option) => <option key={option.id} value={option.id}>{oswLabel(option)}</option>)}
                            </select>
                            <Badge variant={dayType === "TRAVEL" ? "warning" : "outline"}>{dayType === "TRAVEL" ? "วันเดินทาง" : "วันปฏิบัติงาน"}</Badge>
                            {holiday?.holidayType === "PUBLIC_HOLIDAY" ? <Badge variant="warning">{holiday.holidayName ?? "วันหยุดราชการ"}</Badge> : holiday?.holidayType === "WEEKEND" ? <Badge variant="warning">วันหยุดสุดสัปดาห์</Badge> : null}
                          </>
                        ) : null}
                      </div>
                      {selected ? (
                        <div className="mt-3 space-y-2 border-t pt-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              รหัส We Safe {requiresCode ? <span className="font-medium text-destructive">จำเป็นสำหรับวันนี้</span> : "(ถ้ามี)"}
                            </p>
                            <Button type="button" size="sm" variant="outline" onClick={() => addCode(date)}><Plus className="h-3.5 w-3.5" /> เพิ่มรหัส</Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ระบบตรวจเฉพาะความยาว 19 ตัวอักษร ไม่ได้ตรวจสอบความแท้จริงของรหัส ผู้ยื่นรับรองว่าข้อมูลถูกต้อง
                          </p>
                          {selected.weSafeCodes.map((code, index) => (
                            <div key={`${date}-${index}`} className="flex items-center gap-2">
                              <Input
                                value={code}
                                maxLength={19}
                                aria-invalid={code.trim().length !== 19}
                                onChange={(event) => setCode(date, index, event.target.value)}
                                placeholder={`WSZ${date.slice(0, 4)}............`}
                              />
                              <span className="w-12 text-right text-xs text-muted-foreground">{code.trim().length}/19</span>
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCode(date, index)} aria-label="ลบรหัส"><X className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="space-y-2">
            <Label htmlFor="claim-remark">หมายเหตุ</Label>
            <Textarea id="claim-remark" value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isPending}>ปิด</Button>
          <LoadingButton variant="outline" isLoading={isPending} onClick={() => save(false)}>บันทึกฉบับร่าง</LoadingButton>
          <LoadingButton isLoading={isPending} onClick={() => save(true)}><Send className="h-4 w-4" /> บันทึกและส่งยืนยัน</LoadingButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} className="max-w-4xl">
        <DialogClose onClose={() => setDetail(null)} />
        {detail ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-5 w-5" /> {formatMonth(detail.expenseMonth)}
                <Badge variant={claimStatusVariant(detail.status)}>{STATUS_LABEL[detail.status]}</Badge>
              </DialogTitle>
              <DialogDescription>
                {detail.claimant.firstName} {detail.claimant.lastName} · Revision {detail.currentRevisionNo}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">จำนวนวัน</p><p className="text-lg font-semibold">{detail.countDates}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">อัตรา</p><p className="text-lg font-semibold">{detail.currentRevision.ratePerDay.toLocaleString("th-TH")} บาท</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">ยอดรวม</p><p className="text-lg font-semibold">{detail.amount.toLocaleString("th-TH")} บาท</p></div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-180 text-sm">
                  <thead className="bg-muted/60 text-left"><tr><th className="p-3">วันที่</th><th className="p-3">ใบนำตัวหลัก</th><th className="p-3">ประเภท</th><th className="p-3">วันหยุด</th><th className="p-3">We Safe</th><th className="p-3 text-right">บาท</th></tr></thead>
                  <tbody>
                    {detail.currentRevision.workDates.map((date) => {
                      const osw = detail.currentRevision.offSiteWorks.find((item) => item.offSiteWorkId === date.offSiteWorkId);
                      return (
                        <tr key={date.id} className="border-t align-top">
                          <td className="p-3 font-medium">{formatDate(date.date)}</td>
                          <td className="p-3">{osw?.innerRefDocumentId || date.offSiteWorkId}</td>
                          <td className="p-3">{date.dayType === "TRAVEL" ? "เดินทาง" : "ปฏิบัติงาน"}</td>
                          <td className="p-3">{date.holidayName ?? (date.holidayType === "WEEKEND" ? "วันหยุดสุดสัปดาห์" : "-")}</td>
                          <td className="p-3">{date.weSafeCodes.length > 0 ? date.weSafeCodes.map((code, index) => <span key={`${code}-${index}`} className="block font-mono text-xs">{code}</span>) : "-"}</td>
                          <td className="p-3 text-right">{date.dailyRate.toLocaleString("th-TH")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {detail.remark ? <div><h4 className="text-sm font-semibold">หมายเหตุ</h4><p className="text-sm text-muted-foreground">{detail.remark}</p></div> : null}
              <LeaderVerificationSection verifications={detail.leaderVerifications} claimId={detail.id} />
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetail(null)}>ปิด</Button>
              {!(["COLLECTED", "COMPLETED", "CANCELLED"] as ExpenseClaimStatus[]).includes(detail.status) ? <Button onClick={() => { setDetail(null); openEdit(detail); }}><Pencil className="h-4 w-4" /> แก้ไข</Button> : null}
            </DialogFooter>
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="ยกเลิกคำขอนี้?"
        description="ลิงก์และการยืนยันของ revision ปัจจุบันจะถูกยกเลิกด้วย"
        confirmLabel="ยืนยันการยกเลิก"
        isPending={isPending}
        onConfirm={cancelClaim}
      />
    </div>
  );
}
