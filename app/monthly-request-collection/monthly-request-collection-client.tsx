"use client";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Loader2,
  Plus,
  Printer,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelMonthlyRequestCollection,
  createMonthlyRequestCollection,
  listEligibleExpenseClaimsForMonth,
  listMonthlyRequestCollections,
  reviewMonthlyRequestCollectionStep,
  submitMonthlyRequestCollection,
  updateMonthlyRequestCollection,
} from "@/app/actions/monthly-request-collection";
import type {
  EligibleExpenseClaimForCollection,
  MonthlyRequestCollectionWithRelations,
  MrcApprovalStage,
} from "@/lib/domains/monthly-request-collection";
import type { ClaimDocumentStatus } from "@/lib/shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface MrcClientProps {
  initialItems: MonthlyRequestCollectionWithRelations[];
  initialPagination: Pagination | null;
  canManage: boolean;
  canSubmit: boolean;
  canApprove: boolean;
}

type Mode =
  | "create"
  | "edit"
  | "view"
  | "cancel"
  | "review_hpa"
  | "review_rk"
  | "review_ok"
  | null;

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMonthInput(date: Date | string): string {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

function monthDisplay(month: Date | string): string {
  return new Date(month).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
  });
}

function dateTimeDisplay(value: Date | string): string {
  return new Date(value).toLocaleString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function decimalText(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "object" && "toString" in (v as object)) {
    return String((v as { toString(): string }).toString());
  }
  return String(v);
}

function statusLabel(status: ClaimDocumentStatus): string {
  const map: Record<string, string> = {
    DRAFT: "ร่าง",
    PENDING: "รอตรวจสอบ",
    COLLECTED: "รวบรวมแล้ว",
    APPROVED: "อนุมัติแล้ว",
    REJECTED: "ถูกปฏิเสธ",
    CANCELLED: "ยกเลิก",
  };
  return map[status] ?? status;
}

function statusVariant(
  status: ClaimDocumentStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED" || status === "CANCELLED") return "destructive";
  if (status === "PENDING") return "secondary";
  return "outline";
}

function stageLabel(stage: MrcApprovalStage): string {
  const map: Record<MrcApprovalStage, string> = {
    HPA_CHECK: "หผ. ตรวจสอบ",
    RK_CHECK: "รก. ตรวจสอบ",
    OK_APPROVE: "อก. อนุมัติ",
  };
  return map[stage] ?? stage;
}

function stepStatusVariant(
  s: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "APPROVED") return "default";
  if (s === "REJECTED") return "destructive";
  return "outline";
}

function stepStatusLabel(s: string): string {
  if (s === "APPROVED") return "ผ่าน";
  if (s === "REJECTED") return "ปฏิเสธ";
  return "รอดำเนินการ";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MrcStatusBadge({ status }: { status: ClaimDocumentStatus }) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}

function ApprovalTimeline({
  mrc,
}: {
  mrc: MonthlyRequestCollectionWithRelations;
}) {
  const stages: MrcApprovalStage[] = ["HPA_CHECK", "RK_CHECK", "OK_APPROVE"];
  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const step = mrc.approvalSteps.find((s) => s.stage === stage);
        return (
          <div
            key={stage}
            className="flex items-start gap-3 rounded-lg border p-3"
          >
            <div className="mt-0.5">
              {!step && (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              )}
              {step?.status === "PENDING" && (
                <div className="h-4 w-4 rounded-full border-2 border-yellow-500 bg-yellow-100" />
              )}
              {step?.status === "APPROVED" && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {step?.status === "REJECTED" && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{stageLabel(stage)}</span>
                {step && (
                  <Badge
                    variant={stepStatusVariant(step.status)}
                    className="text-xs"
                  >
                    {stepStatusLabel(step.status)}
                  </Badge>
                )}
              </div>
              {step?.reviewer && (
                <p className="text-xs text-muted-foreground mt-1">
                  {step.reviewer.firstName} {step.reviewer.lastName}
                  {step.reviewedAt && ` · ${dateTimeDisplay(step.reviewedAt)}`}
                </p>
              )}
              {step?.remark && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  &quot;{step.remark}&quot;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function MrcClient({
  initialItems,
  initialPagination,
  canManage,
  canSubmit,
  canApprove,
}: MrcClientProps) {
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] =
    useState<MonthlyRequestCollectionWithRelations | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create / edit form state
  const [collectMonth, setCollectMonth] = useState(() =>
    toMonthInput(new Date()),
  );
  const [eligibleClaims, setEligibleClaims] = useState<
    EligibleExpenseClaimForCollection[]
  >([]);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);

  // Review form state
  const [reviewApproved, setReviewApproved] = useState(true);
  const [reviewRemark, setReviewRemark] = useState("");

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  const refresh = useCallback(
    async (nextPage = page) => {
      const result = await listMonthlyRequestCollections({
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      if (!result.success) {
        toast.error("ไม่สามารถโหลดข้อมูลได้", { description: result.error });
        return;
      }
      setItems(result.data.data);
      setPagination(result.data.pagination);
      setPage(result.data.pagination.page);
    },
    [page],
  );

  const loadEligibleClaims = useCallback(
    async (month: string, mrcId?: string) => {
      setIsLoadingClaims(true);
      const result = await listEligibleExpenseClaimsForMonth(month, mrcId);
      if (!result.success) {
        toast.error("ไม่สามารถโหลดรายการเบิกได้", {
          description: result.error,
        });
        setEligibleClaims([]);
      } else {
        setEligibleClaims(result.data);
      }
      setIsLoadingClaims(false);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Open helpers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    const m = toMonthInput(new Date());
    setCollectMonth(m);
    setSelectedClaimIds([]);
    setEligibleClaims([]);
    setMode("create");
    void loadEligibleClaims(m);
  };

  const openEdit = (item: MonthlyRequestCollectionWithRelations) => {
    const m = toMonthInput(item.collectForMonth);
    setSelected(item);
    setCollectMonth(m);
    setSelectedClaimIds(item.expenseClaims.map((c) => c.id));
    setEligibleClaims([]);
    setMode("edit");
    void loadEligibleClaims(m, item.id);
  };

  const openView = (item: MonthlyRequestCollectionWithRelations) => {
    setSelected(item);
    setMode("view");
  };

  const openCancel = (item: MonthlyRequestCollectionWithRelations) => {
    setSelected(item);
    setMode("cancel");
  };

  const openReview = (
    item: MonthlyRequestCollectionWithRelations,
    stage: MrcApprovalStage,
  ) => {
    setSelected(item);
    setReviewApproved(true);
    setReviewRemark("");
    const stageToMode: Record<MrcApprovalStage, Mode> = {
      HPA_CHECK: "review_hpa",
      RK_CHECK: "review_rk",
      OK_APPROVE: "review_ok",
    };
    setMode(stageToMode[stage]);
  };

  const currentReviewStage = useMemo((): MrcApprovalStage | null => {
    if (mode === "review_hpa") return "HPA_CHECK";
    if (mode === "review_rk") return "RK_CHECK";
    if (mode === "review_ok") return "OK_APPROVE";
    return null;
  }, [mode]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const submitCreate = () => {
    startTransition(async () => {
      if (selectedClaimIds.length === 0) {
        toast.error("กรุณาเลือกรายการเบิกอย่างน้อย 1 รายการ");
        return;
      }
      const result = await createMonthlyRequestCollection({
        collectForMonth: `${collectMonth}-01`,
        expenseClaimIds: selectedClaimIds,
      });
      if (!result.success) {
        toast.error("ไม่สามารถสร้างได้", { description: result.error });
        return;
      }
      toast.success("สร้างรายการรวบรวมสำเร็จ");
      setMode(null);
      await refresh(1);
    });
  };

  const submitEdit = () => {
    if (!selected) return;
    startTransition(async () => {
      if (selectedClaimIds.length === 0) {
        toast.error("กรุณาเลือกรายการเบิกอย่างน้อย 1 รายการ");
        return;
      }
      const result = await updateMonthlyRequestCollection(selected.id, {
        expenseClaimIds: selectedClaimIds,
      });
      if (!result.success) {
        toast.error("ไม่สามารถอัปเดตได้", { description: result.error });
        return;
      }
      toast.success("อัปเดตสำเร็จ");
      setMode(null);
      await refresh(page);
    });
  };

  const submitForReview = (id: string) => {
    startTransition(async () => {
      const result = await submitMonthlyRequestCollection(id);
      if (!result.success) {
        toast.error("ไม่สามารถส่งตรวจได้", { description: result.error });
        return;
      }
      toast.success("ส่งเพื่อตรวจสอบสำเร็จ");
      setMode(null);
      await refresh(page);
    });
  };

  const doReview = () => {
    if (!selected || !currentReviewStage) return;
    startTransition(async () => {
      const result = await reviewMonthlyRequestCollectionStep(selected.id, {
        stage: currentReviewStage,
        approved: reviewApproved,
        remark: reviewRemark.trim() || undefined,
      });
      if (!result.success) {
        toast.error("ไม่สามารถดำเนินการได้", { description: result.error });
        return;
      }
      toast.success(reviewApproved ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ");
      setMode(null);
      await refresh(page);
    });
  };

  const doCancel = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await cancelMonthlyRequestCollection(selected.id);
      if (!result.success) {
        toast.error("ไม่สามารถยกเลิกได้", { description: result.error });
        return;
      }
      toast.success("ยกเลิกสำเร็จ");
      setMode(null);
      await refresh(page);
    });
  };

  // ---------------------------------------------------------------------------
  // Eligibility helpers
  // ---------------------------------------------------------------------------

  /** Which review stage can the current user act on for a given MRC? */
  const getActionableStage = useCallback(
    (mrc: MonthlyRequestCollectionWithRelations): MrcApprovalStage | null => {
      if (mrc.status !== "PENDING") return null;
      const pendingStep = mrc.approvalSteps.find((s) => s.status === "PENDING");
      if (!pendingStep) return null;
      if (pendingStep.stage === "OK_APPROVE" && canApprove) return "OK_APPROVE";
      if (
        (pendingStep.stage === "HPA_CHECK" ||
          pendingStep.stage === "RK_CHECK") &&
        canSubmit
      ) {
        return pendingStep.stage;
      }
      return null;
    },
    [canSubmit, canApprove],
  );

  const canCancelMrc = useCallback(
    (mrc: MonthlyRequestCollectionWithRelations): boolean => {
      if (!canManage) return false;
      if (mrc.status === "APPROVED" || mrc.status === "CANCELLED") return false;
      return !mrc.approvalSteps.some((s) => s.status === "APPROVED");
    },
    [canManage],
  );

  // ---------------------------------------------------------------------------
  // Summary row for claim list
  // ---------------------------------------------------------------------------

  const totals = useMemo(() => {
    if (!eligibleClaims.length) return { dates: 0, amount: 0 };
    const selected = eligibleClaims.filter((c) =>
      selectedClaimIds.includes(c.id),
    );
    return {
      dates: selected.reduce(
        (s, c) => s + (c.countDates ? Number(c.countDates) : 0),
        0,
      ),
      amount: selected.reduce(
        (s, c) => s + (c.amount ? Number(c.amount) : 0),
        0,
      ),
    };
  }, [eligibleClaims, selectedClaimIds]);

  // ---------------------------------------------------------------------------
  // On month change in create form — reload claims
  // ---------------------------------------------------------------------------

  const handleMonthChange = (value: string) => {
    setCollectMonth(value);
    setSelectedClaimIds([]);
    void loadEligibleClaims(value, mode === "edit" ? selected?.id : undefined);
  };

  // ---------------------------------------------------------------------------
  // Render: claim table for create/edit
  // ---------------------------------------------------------------------------

  const renderClaimTable = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          รายการเบิกค่าใช้จ่าย (เดือน {monthDisplay(`${collectMonth}-01`)})
        </Label>
        {isLoadingClaims && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {!isLoadingClaims && eligibleClaims.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
          ไม่มีรายการเบิกที่รอดำเนินการสำหรับเดือนนี้
        </p>
      )}

      {eligibleClaims.length > 0 && (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-2 px-3 text-left w-8">
                    <input
                      title="เลือกทั้งหมด"
                      aria-label="เลือกหรือยกเลิกเลือกทั้งหมด"
                      type="checkbox"
                      checked={
                        selectedClaimIds.length === eligibleClaims.length &&
                        eligibleClaims.length > 0
                      }
                      onChange={(e) =>
                        setSelectedClaimIds(
                          e.target.checked
                            ? eligibleClaims.map((c) => c.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th className="py-2 px-3 text-left">ชื่อ-สกุล</th>
                  <th className="py-2 px-3 text-left">ตำแหน่ง</th>
                  <th className="py-2 px-3 text-right">จำนวนวัน</th>
                  <th className="py-2 px-3 text-right">จำนวนเงิน</th>
                  <th className="py-2 px-3 text-center">ดูเอกสาร</th>
                </tr>
              </thead>
              <tbody>
                {eligibleClaims.map((claim) => {
                  const checked = selectedClaimIds.includes(claim.id);
                  return (
                    <tr
                      key={claim.id}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${
                        checked ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() =>
                        setSelectedClaimIds((prev) =>
                          prev.includes(claim.id)
                            ? prev.filter((id) => id !== claim.id)
                            : [...prev, claim.id],
                        )
                      }
                    >
                      <td
                        className="py-2 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          title={`เลือกเอกสารเบิก ${claim.id}`}
                          aria-label={`เลือกเอกสารเบิก ${claim.id}`}
                          checked={checked}
                          onChange={(e) =>
                            setSelectedClaimIds((prev) =>
                              e.target.checked
                                ? [...prev, claim.id]
                                : prev.filter((id) => id !== claim.id),
                            )
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        {claim.claimant.firstName} {claim.claimant.lastName}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {claim.claimantPositionAtSubmission}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {decimalText(claim.countDates)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {decimalText(claim.amount)}
                      </td>
                      <td
                        className="py-2 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`/expense-claim-document?claimId=${claim.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="เปิดเอกสารเบิกในแท็บใหม่"
                          >
                            <ArrowUpRight className="mr-1 h-4 w-4" />
                            เปิดดู
                          </a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedClaimIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                เลือก {selectedClaimIds.length} รายการ
              </span>
              <span className="font-medium tabular-nums">
                รวม {totals.dates} วัน · {totals.amount.toLocaleString("th-TH")}{" "}
                บาท
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: main list
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            รวบรวมเบิกค่าตอบแทนเสี่ยงภัยพิเศษ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการรายการรวบรวมเบิกค่าตอบแทนประจำเดือน
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            สร้างรายการ
          </Button>
        )}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="py-16 text-center border rounded-xl text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีรายการรวบรวม</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="py-3 px-4 text-left font-medium">เดือน</th>
                <th className="py-3 px-4 text-left font-medium">ผู้รวบรวม</th>
                <th className="py-3 px-4 text-right font-medium">รายการ</th>
                <th className="py-3 px-4 text-right font-medium">จำนวนเงิน</th>
                <th className="py-3 px-4 text-left font-medium">สถานะ</th>
                <th className="py-3 px-4 text-right font-medium">
                  การดำเนินการ
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const actionableStage = getActionableStage(item);
                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium">
                      {monthDisplay(item.collectForMonth)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {item.collector.firstName} {item.collector.lastName}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {item.expenseClaims.length}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {decimalText(item.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <MrcStatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openView(item)}
                          title="ดูรายละเอียด"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {item.status === "APPROVED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="พิมพ์"
                          >
                            <a
                              href={`/monthly-request-collection/${item.id}/print`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Printer className="h-4 w-4" />
                            </a>
                          </Button>
                        )}

                        {canManage && item.status === "DRAFT" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(item)}
                              title="แก้ไข"
                            >
                              <CalendarDays className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:text-primary"
                              onClick={() => submitForReview(item.id)}
                              title="ส่งตรวจ"
                              disabled={isPending}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        {actionableStage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary"
                            onClick={() => openReview(item, actionableStage)}
                            title={`ดำเนินการ: ${stageLabel(actionableStage)}`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                        )}

                        {canCancelMrc(item) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openCancel(item)}
                            title="ยกเลิก"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            แสดง {items.length} / {pagination.total} รายการ
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!pagination.hasPrevious || isPending}
              onClick={() => {
                void refresh(page - 1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              หน้า {page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={!pagination.hasNext || isPending}
              onClick={() => {
                void refresh(page + 1);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Create dialog ────────────────────────────────────────── */}
      <Dialog open={mode === "create"} onClose={() => setMode(null)}>
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>สร้างรายการรวบรวมใหม่</DialogTitle>
          <DialogDescription>
            เลือกเดือนและรายการเบิกที่ต้องการรวบรวม
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-month">เดือน</Label>
            <input
              title="เลือกเดือนที่ต้องการรวบรวมรายการเบิก"
              id="create-month"
              type="month"
              value={collectMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          {renderClaimTable()}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={submitCreate}
            disabled={isPending || selectedClaimIds.length === 0}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ─── Edit dialog ──────────────────────────────────────────── */}
      <Dialog open={mode === "edit"} onClose={() => setMode(null)}>
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>แก้ไขรายการรวบรวม</DialogTitle>
          <DialogDescription>
            เดือน: {selected ? monthDisplay(selected.collectForMonth) : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>{renderClaimTable()}</DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={submitEdit}
            disabled={isPending || selectedClaimIds.length === 0}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ─── View dialog ──────────────────────────────────────────── */}
      <Dialog open={mode === "view"} onClose={() => setMode(null)}>
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            รายละเอียด
            {selected && <MrcStatusBadge status={selected.status} />}
          </DialogTitle>
          <DialogDescription>
            {selected && monthDisplay(selected.collectForMonth)}
          </DialogDescription>
        </DialogHeader>
        {selected && (
          <DialogBody className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">รายการทั้งหมด</p>
                <p className="text-xl font-bold mt-0.5">
                  {selected.expenseClaims.length} รายการ
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">จำนวนเงินรวม</p>
                <p className="text-xl font-bold mt-0.5">
                  {decimalText(selected.amount)} บาท
                </p>
              </div>
            </div>

            {/* Claims list */}
            <div>
              <p className="text-sm font-medium mb-2">รายการเบิก</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-2 px-3 text-left">ชื่อ-สกุล</th>
                      <th className="py-2 px-3 text-left">ตำแหน่ง</th>
                      <th className="py-2 px-3 text-right">วัน</th>
                      <th className="py-2 px-3 text-right">เงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.expenseClaims.map((claim) => (
                      <tr key={claim.id} className="border-b last:border-0">
                        <td className="py-2 px-3">
                          {claim.claimant.firstName} {claim.claimant.lastName}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">
                          {claim.claimantPositionAtSubmission}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {decimalText(claim.countDates)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {decimalText(claim.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval timeline */}
            <div>
              <p className="text-sm font-medium mb-2">สถานะการตรวจสอบ</p>
              <ApprovalTimeline mrc={selected} />
            </div>

            {/* Rejection remark from latest rejected step */}
            {selected.status === "REJECTED" &&
              (() => {
                const rejectedStep = [...selected.approvalSteps]
                  .reverse()
                  .find((s) => s.status === "REJECTED");
                return rejectedStep?.remark ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 text-destructive mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        เหตุผลที่ปฏิเสธ
                      </span>
                    </div>
                    <p className="text-sm">{rejectedStep.remark}</p>
                  </div>
                ) : null;
              })()}
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode(null)}>
            ปิด
          </Button>
          {selected?.status === "APPROVED" && (
            <Button asChild>
              <a
                href={`/monthly-request-collection/${selected.id}/print`}
                target="_blank"
                rel="noreferrer"
              >
                <Printer className="mr-2 h-4 w-4" />
                พิมพ์
              </a>
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* ─── Review dialog ────────────────────────────────────────── */}
      <Dialog
        open={["review_hpa", "review_rk", "review_ok"].includes(mode ?? "")}
        onClose={() => setMode(null)}
      >
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>
            {currentReviewStage ? stageLabel(currentReviewStage) : "ตรวจสอบ"}
          </DialogTitle>
          <DialogDescription>
            {selected && monthDisplay(selected.collectForMonth)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setReviewApproved(true)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors ${
                reviewApproved
                  ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : "hover:bg-muted/40"
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
              อนุมัติ / ผ่าน
            </button>
            <button
              type="button"
              onClick={() => setReviewApproved(false)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors ${
                !reviewApproved
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "hover:bg-muted/40"
              }`}
            >
              <ThumbsDown className="h-4 w-4" />
              ปฏิเสธ
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-remark">
              หมายเหตุ{" "}
              {!reviewApproved && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="review-remark"
              value={reviewRemark}
              onChange={(e) => setReviewRemark(e.target.value)}
              placeholder={
                reviewApproved
                  ? "หมายเหตุ (ถ้ามี)"
                  : "กรุณาระบุเหตุผลที่ปฏิเสธ..."
              }
              rows={3}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={doReview}
            disabled={isPending || (!reviewApproved && !reviewRemark.trim())}
            variant={reviewApproved ? "default" : "destructive"}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {reviewApproved ? "ยืนยันการอนุมัติ" : "ยืนยันการปฏิเสธ"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ─── Cancel confirm dialog ────────────────────────────────── */}
      <Dialog open={mode === "cancel"} onClose={() => setMode(null)}>
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            ยืนยันการยกเลิก
          </DialogTitle>
          <DialogDescription>
            ยกเลิกรายการรวบรวมเดือน{" "}
            {selected ? monthDisplay(selected.collectForMonth) : ""}?
            รายการเบิกที่รวบรวมไว้จะถูกคืนสถานะเป็น &quot;รอตรวจสอบ&quot;
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            ไม่ยกเลิก
          </Button>
          <Button variant="destructive" onClick={doCancel} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ยืนยันการยกเลิก
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
