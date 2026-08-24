"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Ban,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelMonthlyRequestCollection,
  completeMonthlyRequestCollection,
  createMonthlyRequestCollection,
  finalizeMonthlyRequestCollection,
  listEligibleExpenseClaimsForMonth,
  listMonthlyRequestCollections,
  listMonthlyRequestDepartments,
  updateMonthlyRequestCollection,
  voidMonthlyRequestCollection,
} from "@/app/actions/monthly-request-collection";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type {
  EligibleExpenseClaimForCollection,
  MrcDepartmentOption,
  MonthlyRequestCollectionWithRelations,
  MonthlyRequestStatus,
} from "@/lib/domains/monthly-request-collection";
import {
  dateTimeDisplay,
  moneyDisplay,
  monthDisplay,
  shortDateDisplay,
  toMonthInput,
} from "@/lib/shared/format";
import type { Pagination } from "@/lib/shared/types";

interface MrcClientProps {
  initialItems: MonthlyRequestCollectionWithRelations[];
  initialPagination: Pagination | null;
  canManage: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canFinalize?: boolean;
  canComplete?: boolean;
  canCancel?: boolean;
  canVoid?: boolean;
  canPrint?: boolean;
  canExport?: boolean;
}

type DialogMode = "form" | "detail" | "complete" | "reason" | null;
type ReasonAction = "cancel" | "void";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<MonthlyRequestStatus, string> = {
  DRAFT: "ร่าง",
  FINALIZED: "สรุปแล้ว / รอลงนามกระดาษ",
  ALL_DONE: "เสร็จสิ้น",
  CANCELLED: "ยกเลิกร่าง",
  VOIDED: "ยกเลิกเอกสาร",
};

const STATUS_VARIANT: Record<MonthlyRequestStatus, BadgeVariant> = {
  DRAFT: "secondary",
  FINALIZED: "warning",
  ALL_DONE: "success",
  CANCELLED: "outline",
  VOIDED: "destructive",
};

function bangkokDateTimeInputNow(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function itemDateSummary(item: MonthlyRequestCollectionWithRelations["items"][number]) {
  return item.dates.map((date) => shortDateDisplay(date.workDate)).join(", ");
}

export function MrcClient({
  initialItems,
  initialPagination,
  canManage,
  canCreate,
  canUpdate,
  canFinalize,
  canComplete,
  canCancel,
  canVoid,
  canPrint,
  canExport,
}: MrcClientProps) {
  const permissions = {
    create: canCreate ?? canManage,
    update: canUpdate ?? canManage,
    finalize: canFinalize ?? canManage,
    complete: canComplete ?? canManage,
    cancel: canCancel ?? canManage,
    void: canVoid ?? canManage,
    print: canPrint ?? canManage,
    export: canExport ?? canManage,
  };
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<MonthlyRequestCollectionWithRelations | null>(null);
  const [isPending, startTransition] = useTransition();

  const [departments, setDepartments] = useState<MrcDepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [collectMonth, setCollectMonth] = useState(() => toMonthInput(new Date()));
  const [eligible, setEligible] = useState<EligibleExpenseClaimForCollection[]>([]);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [paperApprovedAt, setPaperApprovedAt] = useState(bangkokDateTimeInputNow);
  const [note, setNote] = useState("");
  const [reasonAction, setReasonAction] = useState<ReasonAction>("cancel");
  const [reason, setReason] = useState("");

  const selectedTotal = useMemo(
    () =>
      eligible
        .filter((claim) => selectedClaimIds.includes(claim.id))
        .reduce(
          (total, claim) => ({
            count: total.count + 1,
            days: total.days + claim.dayCount,
            amount: total.amount + claim.amount,
          }),
          { count: 0, days: 0, amount: 0 },
        ),
    [eligible, selectedClaimIds],
  );

  const refresh = useCallback(
    (targetPage = page) => {
      startTransition(async () => {
        const result = await listMonthlyRequestCollections({
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setItems(result.data.data);
        setPagination(result.data.pagination);
        setPage(targetPage);
      });
    },
    [page],
  );

  const loadDepartments = async (): Promise<MrcDepartmentOption[]> => {
    if (departments.length > 0) return departments;
    const result = await listMonthlyRequestDepartments();
    if (!result.success) {
      toast.error(result.error);
      return [];
    }
    setDepartments(result.data);
    return result.data;
  };

  const loadEligible = async (
    month = collectMonth,
    department = departmentId,
    existingId?: string,
  ) => {
    if (!month || !department) {
      toast.error("กรุณาเลือกเดือนและหน่วยงาน");
      return;
    }
    setLoadingEligible(true);
    const result = await listEligibleExpenseClaimsForMonth(
      month,
      department,
      existingId,
    );
    setLoadingEligible(false);
    if (!result.success) {
      toast.error(result.error);
      setEligible([]);
      return;
    }
    setEligible(result.data);
  };

  const openCreate = () => {
    startTransition(async () => {
      const options = await loadDepartments();
      setSelected(null);
      setIsEditing(false);
      setCollectMonth(toMonthInput(new Date()));
      setDepartmentId(options[0]?.id ?? "");
      setEligible([]);
      setSelectedClaimIds([]);
      setDialogMode("form");
    });
  };

  const openEdit = (mrc: MonthlyRequestCollectionWithRelations) => {
    startTransition(async () => {
      await loadDepartments();
      const month = toMonthInput(mrc.collectForMonth);
      setSelected(mrc);
      setIsEditing(true);
      setCollectMonth(month);
      setDepartmentId(mrc.departmentId);
      setSelectedClaimIds(mrc.items.map((item) => item.expenseClaimId));
      setDialogMode("form");
      await loadEligible(month, mrc.departmentId, mrc.id);
    });
  };

  const saveDraft = () => {
    if (!departmentId || selectedClaimIds.length === 0) {
      toast.error("กรุณาเลือกหน่วยงานและคำขออย่างน้อย 1 รายการ");
      return;
    }
    startTransition(async () => {
      const result = isEditing && selected
        ? await updateMonthlyRequestCollection(selected.id, {
            expenseClaimIds: selectedClaimIds,
          })
        : await createMonthlyRequestCollection({
            collectForMonth: `${collectMonth}-01`,
            departmentId,
            expenseClaimIds: selectedClaimIds,
          });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "บันทึกร่างแล้ว");
      setDialogMode(null);
      refresh(1);
    });
  };

  const finalize = (mrc: MonthlyRequestCollectionWithRelations) => {
    if (!window.confirm("ยืนยันสรุปเอกสาร? หลังจากนี้ข้อมูลและ snapshot จะแก้ไขไม่ได้")) return;
    startTransition(async () => {
      const result = await finalizeMonthlyRequestCollection(mrc.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("สรุปเอกสารแล้ว พร้อมพิมพ์และส่งออก Excel");
      refresh();
    });
  };

  const complete = () => {
    if (!selected || !paperApprovedAt) return;
    startTransition(async () => {
      const result = await completeMonthlyRequestCollection(selected.id, {
        paperApprovedAt,
        note,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("บันทึกผลยืนยัน อก.ฝช. แล้ว");
      setDialogMode(null);
      refresh();
    });
  };

  const submitReason = () => {
    if (!selected || !reason.trim()) {
      toast.error("กรุณาระบุเหตุผล");
      return;
    }
    startTransition(async () => {
      const result = reasonAction === "cancel"
        ? await cancelMonthlyRequestCollection(selected.id, reason)
        : await voidMonthlyRequestCollection(selected.id, reason);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (reasonAction === "void" && "replacementDraft" in result.data) {
        toast.success(`ยกเลิกเอกสารแล้ว และรวมเข้าร่างทดแทน ${result.data.replacementDraft.id.slice(0, 8)}`);
      } else {
        toast.success(result.message ?? "บันทึกแล้ว");
      }
      setDialogMode(null);
      refresh();
    });
  };

  const openComplete = (mrc: MonthlyRequestCollectionWithRelations) => {
    setSelected(mrc);
    setPaperApprovedAt(bangkokDateTimeInputNow());
    setNote("");
    setDialogMode("complete");
  };

  const openReason = (mrc: MonthlyRequestCollectionWithRelations, action: ReasonAction) => {
    setSelected(mrc);
    setReasonAction(action);
    setReason("");
    setDialogMode("reason");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Monthly Request</h2>
          <p className="text-sm text-muted-foreground">
            สรุปข้อมูล → พิมพ์ลงนามจริง → บันทึกผลยืนยัน อก.ฝช.
          </p>
        </div>
        {permissions.create && (
          <Button onClick={openCreate} disabled={isPending}>
            <Plus /> เพิ่มคำขอเข้าร่าง
          </Button>
        )}
      </div>

      {isPending && items.length === 0 ? (
        <TableSkeleton rows={5} columns={6} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          ยังไม่มี Monthly Request
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-3">เดือน / ชุด</th>
                <th className="p-3">หน่วยงาน</th>
                <th className="p-3 text-right">คำขอ</th>
                <th className="p-3 text-right">วัน</th>
                <th className="p-3 text-right">ยอดรวม</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((mrc) => (
                <tr key={mrc.id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-medium">{monthDisplay(mrc.collectForMonth)}</div>
                    <div className="text-xs text-muted-foreground">
                      {mrc.batchNo ? `ชุดที่ ${mrc.batchNo}` : "ยังไม่กำหนดเลขชุด"}
                    </div>
                  </td>
                  <td className="p-3">{mrc.department.shortName || mrc.department.name}</td>
                  <td className="p-3 text-right tabular-nums">{mrc.claimCount}</td>
                  <td className="p-3 text-right tabular-nums">{mrc.countDates}</td>
                  <td className="p-3 text-right tabular-nums">{moneyDisplay(mrc.amount)}</td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[mrc.status]}>{STATUS_LABEL[mrc.status]}</Badge></td>
                  <td className="p-3">
                    <div className="flex min-w-56 flex-wrap justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" title="ดูรายละเอียด" onClick={() => { setSelected(mrc); setDialogMode("detail"); }}><Eye /></Button>
                      {mrc.status === "DRAFT" && permissions.update && (
                        <Button size="icon-sm" variant="ghost" title="แก้ไขร่าง" onClick={() => openEdit(mrc)}><Pencil /></Button>
                      )}
                      {((mrc.status === "DRAFT" || mrc.status === "FINALIZED" || mrc.status === "ALL_DONE" || mrc.status === "VOIDED") && permissions.print) && (
                        <Button size="icon-sm" variant="ghost" title={mrc.status === "DRAFT" ? "พิมพ์ตัวอย่าง" : "พิมพ์เอกสาร"} onClick={() => window.open(`/monthly-request-collection/${mrc.id}/print`, "_blank", "noopener,noreferrer")}><Printer /></Button>
                      )}
                      {(mrc.status === "FINALIZED" || mrc.status === "ALL_DONE") && permissions.export && (
                        <Button size="icon-sm" variant="ghost" title="Export Excel" onClick={() => window.location.assign(`/api/monthly-request-collections/${mrc.id}/export`)}><Download /></Button>
                      )}
                      {mrc.status === "DRAFT" && permissions.finalize && (
                        <Button size="sm" variant="outline" onClick={() => finalize(mrc)}><FileCheck2 /> สรุป</Button>
                      )}
                      {mrc.status === "FINALIZED" && permissions.complete && (
                        <Button size="sm" variant="outline" onClick={() => openComplete(mrc)}><CheckCircle2 /> All Done</Button>
                      )}
                      {mrc.status === "DRAFT" && permissions.cancel && (
                        <Button size="icon-sm" variant="ghost" title="ยกเลิกร่าง" onClick={() => openReason(mrc, "cancel")}><XCircle /></Button>
                      )}
                      {(mrc.status === "FINALIZED" || mrc.status === "ALL_DONE") && permissions.void && (
                        <Button size="icon-sm" variant="ghost" title="Void และสร้างร่างทดแทน" onClick={() => openReason(mrc, "void")}><Ban /></Button>
                      )}
                      {mrc.status === "VOIDED" && mrc.replacementSources.length > 0 && <RotateCcw className="mt-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && (
        <PaginationControls
          pagination={pagination}
          isPending={isPending}
          onPrevious={() => refresh(page - 1)}
          onNext={() => refresh(page + 1)}
        />
      )}

      <Dialog open={dialogMode === "form"} onClose={() => setDialogMode(null)} className="max-w-5xl">
        <DialogClose onClose={() => setDialogMode(null)} />
        <DialogHeader>
          <DialogTitle>{isEditing ? "แก้ไขร่าง Monthly Request" : "เพิ่มคำขอเข้าร่าง Monthly Request"}</DialogTitle>
          <DialogDescription>รายการในร่างยังแก้ไขได้ และจะถูกล็อกถาวรเมื่อกดสรุป</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>เดือน</Label>
              <Input type="month" value={collectMonth} onChange={(event) => { setCollectMonth(event.target.value); setEligible([]); setSelectedClaimIds([]); }} disabled={isEditing} />
            </div>
            <div className="space-y-2">
              <Label>หน่วยงาน</Label>
              <Select
                options={departments.map((department) => ({ value: department.id, label: department.shortName ? `${department.name} (${department.shortName})` : department.name }))}
                value={departmentId}
                onValueChange={(value) => { setDepartmentId(value); setEligible([]); setSelectedClaimIds([]); }}
                placeholder="เลือกหน่วยงาน"
                disabled={isEditing}
              />
            </div>
          </div>
          <Button variant="outline" onClick={() => loadEligible(collectMonth, departmentId, isEditing ? selected?.id : undefined)} disabled={loadingEligible || !departmentId || !collectMonth}>
            {loadingEligible ? "กำลังโหลด..." : "โหลดคำขอที่พร้อมรวบรวม"}
          </Button>
          {eligible.length > 0 ? (
            <div className="max-h-96 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted"><tr><th className="w-12 p-3" /><th className="p-3 text-left">ผู้ขอ</th><th className="p-3 text-left">วันที่</th><th className="p-3 text-right">วัน</th><th className="p-3 text-right">ยอด</th></tr></thead>
                <tbody>
                  {eligible.map((claim) => (
                    <tr key={claim.id} className="border-t">
                      <td className="p-3 text-center"><input type="checkbox" checked={selectedClaimIds.includes(claim.id)} onChange={() => setSelectedClaimIds((current) => current.includes(claim.id) ? current.filter((id) => id !== claim.id) : [...current, claim.id])} /></td>
                      <td className="p-3"><div className="font-medium">{claim.employeeId} · {claim.firstName} {claim.lastName}</div><div className="text-xs text-muted-foreground">{claim.positionShort} {claim.positionLevel ?? ""}{claim.isInCurrentDraft ? " · อยู่ในร่างนี้" : ""}</div></td>
                      <td className="p-3 text-xs">{claim.workDates.map((date) => shortDateDisplay(date)).join(", ")}</td>
                      <td className="p-3 text-right">{claim.dayCount}</td>
                      <td className="p-3 text-right">{moneyDisplay(claim.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded-lg bg-muted/50 p-5 text-center text-sm text-muted-foreground">โหลดข้อมูลเพื่อเลือกคำขอ</p>}
          <div className="flex justify-end gap-5 rounded-lg bg-muted/50 p-3 text-sm"><span>{selectedTotal.count} คำขอ</span><span>{selectedTotal.days} วัน</span><span>{moneyDisplay(selectedTotal.amount)} บาท</span></div>
        </DialogBody>
        <DialogFooter><Button variant="outline" onClick={() => setDialogMode(null)}>ปิด</Button><LoadingButton isLoading={isPending} onClick={saveDraft}>บันทึกร่าง</LoadingButton></DialogFooter>
      </Dialog>

      <Dialog open={dialogMode === "detail"} onClose={() => setDialogMode(null)} className="max-w-5xl">
        <DialogClose onClose={() => setDialogMode(null)} />
        <DialogHeader><DialogTitle>รายละเอียด Monthly Request</DialogTitle><DialogDescription>{selected ? `${monthDisplay(selected.collectForMonth)} · ${selected.department.name} · ${STATUS_LABEL[selected.status]}` : ""}</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4">
          {selected && (
            <>
              <div className="grid gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3"><div>ชุดที่: <b>{selected.batchNo ?? "DRAFT"}</b></div><div>คำขอ: <b>{selected.claimCount}</b></div><div>ยอดรวม: <b>{moneyDisplay(selected.amount)} บาท</b></div></div>
              <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">ผู้ขอ</th><th className="p-3 text-left">ตำแหน่ง</th><th className="p-3 text-left">วันที่ snapshot</th><th className="p-3 text-right">ยอด</th></tr></thead><tbody>{selected.items.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.employeeIdSnapshot} · {item.firstNameSnapshot} {item.lastNameSnapshot}</td><td className="p-3">{item.positionShortSnapshot} {item.positionLevelSnapshot ?? ""}</td><td className="p-3 text-xs">{itemDateSummary(item)}</td><td className="p-3 text-right">{moneyDisplay(item.amountSnapshot)}</td></tr>)}</tbody></table></div>
              {selected.snapshotHash && <p className="break-all text-xs text-muted-foreground">Snapshot SHA-256: {selected.snapshotHash}</p>}
              {selected.finalizedAt && <p className="text-sm">สรุปเมื่อ {dateTimeDisplay(selected.finalizedAt)}</p>}
              {selected.paperApprovedAt && <p className="text-sm">อก.ฝช. ยืนยันเอกสารเมื่อ {dateTimeDisplay(selected.paperApprovedAt)}</p>}
              {selected.voidReason && <p className="text-sm text-destructive">เหตุผล Void: {selected.voidReason}</p>}
              {selected.cancelReason && <p className="text-sm text-muted-foreground">เหตุผลยกเลิกร่าง: {selected.cancelReason}</p>}
            </>
          )}
        </DialogBody>
        <DialogFooter><Button onClick={() => setDialogMode(null)}>ปิด</Button></DialogFooter>
      </Dialog>

      <Dialog open={dialogMode === "complete"} onClose={() => setDialogMode(null)}>
        <DialogClose onClose={() => setDialogMode(null)} />
        <DialogHeader><DialogTitle>บันทึก All Done</DialogTitle><DialogDescription>บันทึกหลังได้รับการยืนยันจาก อก.ฝช. บนเอกสารกระดาษแล้ว</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4"><div className="space-y-2"><Label>วันที่และเวลาที่อนุมัติ</Label><Input type="datetime-local" value={paperApprovedAt} max={bangkokDateTimeInputNow()} onChange={(event) => setPaperApprovedAt(event.target.value)} /></div><div className="space-y-2"><Label>หมายเหตุ (ถ้ามี)</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></div></DialogBody>
        <DialogFooter><Button variant="outline" onClick={() => setDialogMode(null)}>ปิด</Button><LoadingButton isLoading={isPending} onClick={complete}><CheckCircle2 /> ยืนยัน All Done</LoadingButton></DialogFooter>
      </Dialog>

      <Dialog open={dialogMode === "reason"} onClose={() => setDialogMode(null)}>
        <DialogClose onClose={() => setDialogMode(null)} />
        <DialogHeader><DialogTitle>{reasonAction === "cancel" ? "ยกเลิกร่าง" : "Void เอกสารและทำร่างทดแทน"}</DialogTitle><DialogDescription>{reasonAction === "void" ? "เอกสารเดิมจะถูกประทับ VOID และคำขอทั้งหมดจะถูกรวมเข้าร่างทดแทนของหน่วยงาน/เดือนเดียวกันโดยอัตโนมัติ" : "คำขอในร่างจะกลับไปอยู่สถานะพร้อมรวบรวม"}</DialogDescription></DialogHeader>
        <DialogBody><div className="space-y-2"><Label>เหตุผล</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div></DialogBody>
        <DialogFooter><Button variant="outline" onClick={() => setDialogMode(null)}>ปิด</Button><LoadingButton variant="destructive" isLoading={isPending} onClick={submitReason}>{reasonAction === "cancel" ? <XCircle /> : <Ban />} ยืนยัน</LoadingButton></DialogFooter>
      </Dialog>
    </div>
  );
}
