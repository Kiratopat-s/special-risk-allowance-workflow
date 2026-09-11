"use client";
import { useWorkflowTransition as useTransition } from "@/lib/hooks/use-workflow-transition";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/workflow-ui/table";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collectionActionStage } from "@/lib/ui/collection-actions";
import { useScopedPermission } from "@/lib/hooks/use-scoped-permission";
import { parseClaimListQuery, updateListQuery } from "@/lib/ui/list-query";
import {
  Checkbox,
  Select as Dropdown,
} from "@/components/workflow-ui/form-controls";
import { DatePicker } from "@/components/workflow-ui/date-picker";
import { Input } from "@/components/workflow-ui/input";
import { STATUS_LABELS } from "@/components/workflow-ui/status-badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Eye,
  Plus,
  Printer,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/workflow-ui/button";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/workflow-ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/workflow-ui/textarea";
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
import type { Pagination } from "@/lib/shared/types";
import { monthDisplay, decimalText, toMonthInput } from "@/lib/shared/format";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { ConfirmDialog } from "@/components/workflow-ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  ApprovalTimeline,
  MrcStatusBadge,
  stageLabel,
  mrcStatusVariant as statusVariant,
  mrcStatusLabel as statusLabel,
} from "./approval-timeline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MrcClientProps {
  initialItems: MonthlyRequestCollectionWithRelations[];
  initialPagination: Pagination | null;
  canManage: boolean;
  canHpa: boolean;
  canRk: boolean;
  canDrt: boolean;
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
// Main client component
// ---------------------------------------------------------------------------

export function MrcClient({
  initialItems,
  initialPagination,
  canManage,
  canHpa,
  canRk,
  canDrt,
}: MrcClientProps) {
  const { userId } = useScopedPermission("MONTHLY_REQUEST");
  const router = useRouter();
  const query = useSearchParams();
  const filters = useMemo(
    () => parseClaimListQuery(new URLSearchParams(query)),
    [query],
  );
  const [search, setSearch] = useState(query.get("search") || "");
  const navigateList = (
    changes: Record<string, string | number | undefined>,
    reset = true,
  ) =>
    router.push(
      `/dashboard?${updateListQuery(query.toString(), changes, reset)}`,
      { scroll: false },
    );
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
        search: filters.search,
        status: filters.status,
        collectForMonthFrom: filters.expenseMonthFrom,
        collectForMonthTo: filters.expenseMonthTo,
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
      router.refresh();
    },
    [page, filters, router],
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
      await refresh(page);
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
        if (result.code === "SIGNATURE_REQUIRED") {
          toast.error("กรุณาลงลายมือชื่อก่อนอนุมัติ", {
            description:
              "คุณยังไม่มีลายมือชื่อที่ใช้งานอยู่ กรุณาลงลายมือชื่อก่อนดำเนินการ",
            action: {
              label: "ไปลงลายมือชื่อ",
              onClick: () => window.open("/profile", "_blank"),
            },
          });
          return;
        }
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
      return collectionActionStage(mrc, { hpa: canHpa, rk: canRk, ok: canDrt });
    },
    [canHpa, canRk, canDrt],
  );

  const canCancelMrc = useCallback(
    (mrc: MonthlyRequestCollectionWithRelations): boolean => {
      if (!canManage && mrc.collectorId !== userId) return false;
      if (mrc.status === "APPROVED" || mrc.status === "CANCELLED") return false;
      return !mrc.approvalSteps.some((s) => s.status === "APPROVED");
    },
    [canManage, userId],
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
    <div className="space-y-3" aria-busy={isLoadingClaims || undefined}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          รายการเบิกค่าใช้จ่าย (เดือน {monthDisplay(`${collectMonth}-01`)})
        </Label>
      </div>

      {isLoadingClaims && <TableSkeleton columns={7} rows={4} />}

      {!isLoadingClaims && eligibleClaims.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
          ไม่มีรายการเบิกที่รอดำเนินการสำหรับเดือนนี้
        </p>
      )}

      {!isLoadingClaims && eligibleClaims.length > 0 && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHead>
                <TableRow className="border-b bg-muted/50">
                  <TableHeader className="py-2 px-3 text-left w-8">
                    <Checkbox
                      title="เลือกทั้งหมด"
                      aria-label="เลือกหรือยกเลิกเลือกทั้งหมด"
                      checked={
                        eligibleClaims.length > 0 &&
                        eligibleClaims.every((c) =>
                          selectedClaimIds.includes(c.id),
                        )
                      }
                      onChange={(e) =>
                        setSelectedClaimIds(
                          e.target.checked
                            ? eligibleClaims.map((c) => c.id)
                            : [],
                        )
                      }
                    />
                  </TableHeader>
                  <TableHeader className="py-2 px-3 text-left">
                    ชื่อ-สกุล
                  </TableHeader>
                  <TableHeader className="py-2 px-3 text-left">
                    ตำแหน่ง
                  </TableHeader>
                  <TableHeader className="py-2 px-3 text-left">
                    สถานะ
                  </TableHeader>
                  <TableHeader className="py-2 px-3 text-right">
                    จำนวนวัน
                  </TableHeader>
                  <TableHeader className="py-2 px-3 text-right">
                    จำนวนเงิน
                  </TableHeader>
                  <TableHeader className="py-2 px-3 text-center">
                    ดูเอกสาร
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligibleClaims.map((claim) => {
                  const checked = selectedClaimIds.includes(claim.id);
                  return (
                    <TableRow
                      key={claim.id}
                      className={`border-b last:border-0 transition-colors ${
                        checked
                          ? "bg-primary/5 cursor-pointer"
                          : "hover:bg-muted/30 cursor-pointer"
                      }`}
                      onClick={() => {
                        setSelectedClaimIds((prev) =>
                          prev.includes(claim.id)
                            ? prev.filter((id) => id !== claim.id)
                            : [...prev, claim.id],
                        );
                      }}
                    >
                      <TableCell
                        className="py-2 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
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
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        {claim.claimant.firstName} {claim.claimant.lastName}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-muted-foreground text-xs">
                        {claim.claimantPositionAtSubmission}
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <Badge
                          variant={statusVariant(claim.status)}
                          className="text-[10px]"
                        >
                          {statusLabel(claim.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right tabular-nums">
                        {decimalText(claim.countDates)}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right tabular-nums">
                        {decimalText(claim.amount)}
                      </TableCell>
                      <TableCell
                        className="py-2 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`/dashboard?tab=expense-claims&claimId=${claim.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="เปิดเอกสารเบิกในแท็บใหม่"
                          >
                            <ArrowUpRight className="mr-1 h-4 w-4" />
                            เปิดดู
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
      <div className="page-heading">
        <div>
          <div className="eyebrow">MONTHLY COLLECTIONS</div>
          <h1>รวบรวมเบิกค่าตอบแทนเสี่ยงภัยพิเศษ</h1>
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

      <div className="document-panel document-toolbar">
        <div className="flex-1 min-w-48">
          <Input
            aria-label="ค้นหารายการรวบรวม"
            placeholder="ค้นหารายการรวบรวม"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") navigateList({ search });
            }}
          />
        </div>
        <Button variant="outline" onClick={() => navigateList({ search })}>
          ค้นหา
        </Button>
        <div className="w-44">
          <Dropdown
            label="สถานะรายการรวบรวม"
            hideLabel
            value={query.get("status") || ""}
            onValueChange={(value) => navigateList({ status: value })}
            options={[
              { value: "", label: "ทุกสถานะ" },
              ...["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(
                (value) => ({
                  value,
                  label: STATUS_LABELS[value as keyof typeof STATUS_LABELS],
                }),
              ),
            ]}
          />
        </div>
        <div className="w-44">
          <DatePicker
            commitOnBlur
            label="เดือนที่รวบรวม"
            hideLabel
            kind="month"
            value={query.get("month") || ""}
            onValueChange={(value) => navigateList({ month: value })}
          />
        </div>
      </div>
      {/* Table */}
      {items.length === 0 ? (
        <div className="py-16 text-center border rounded-xl text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีรายการรวบรวม</p>
        </div>
      ) : (
        <div
          aria-busy={isPending || undefined}
          className="document-panel overflow-x-auto"
        >
          <Table className="w-full text-sm">
            <TableHead>
              <TableRow className="border-b bg-muted/50">
                <TableHeader className="py-3 px-4 text-left font-medium">
                  เดือน
                </TableHeader>
                <TableHeader className="py-3 px-4 text-left font-medium">
                  ผู้รวบรวม
                </TableHeader>
                <TableHeader className="py-3 px-4 text-right font-medium">
                  รายการ
                </TableHeader>
                <TableHeader className="py-3 px-4 text-right font-medium">
                  จำนวนเงิน
                </TableHeader>
                <TableHeader className="py-3 px-4 text-left font-medium">
                  สถานะ
                </TableHeader>
                <TableHeader className="py-3 px-4 text-right font-medium">
                  การดำเนินการ
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const actionableStage = getActionableStage(item);
                return (
                  <TableRow
                    key={item.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`ดูรายละเอียดรายการรวบรวม ${item.id}`}
                    onClick={() => openView(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openView(item);
                      }
                    }}
                    className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                  >
                    <TableCell className="py-3 px-4 font-medium">
                      {monthDisplay(item.collectForMonth)}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground">
                      {item.collector.firstName} {item.collector.lastName}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right tabular-nums">
                      {item.expenseClaims.length}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right tabular-nums">
                      {decimalText(item.amount)}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <MrcStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation();
                            openView(item);
                          }}
                          title="ดูรายละเอียด"
                          aria-label={`ดูรายละเอียด ${item.id}`}
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
                            aria-label={`พิมพ์ ${item.id}`}
                          >
                            <a
                              href={`/monthly-request-collection/${item.id}/print`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
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
                              onClick={(event) => {
                                event.stopPropagation();
                                openEdit(item);
                              }}
                              title="แก้ไข"
                              aria-label={`แก้ไข ${item.id}`}
                            >
                              <CalendarDays className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:text-primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                submitForReview(item.id);
                              }}
                              title="ส่งตรวจ"
                              disabled={isPending}
                              aria-label={`ส่งตรวจ ${item.id}`}
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
                            onClick={(event) => {
                              event.stopPropagation();
                              openReview(item, actionableStage);
                            }}
                            title={`ดำเนินการ: ${stageLabel(actionableStage)}`}
                            aria-label={`ดำเนินการ ${stageLabel(
                              actionableStage,
                            )} สำหรับ ${item.id}`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                        )}

                        {canCancelMrc(item) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCancel(item);
                            }}
                            title="ยกเลิก"
                            aria-label={`ยกเลิก ${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pagination && (
        <PaginationControls
          pagination={pagination}
          isPending={isPending}
          onPrevious={() => navigateList({ page: page - 1 }, false)}
          onNext={() => navigateList({ page: page + 1 }, false)}
          label={
            <p className="text-sm text-muted-foreground">
              แสดง {items.length} / {pagination.total} รายการ · หน้า {page} /{" "}
              {pagination.totalPages}
            </p>
          }
        />
      )}

      {/* ─── Create dialog ────────────────────────────────────────── */}
      <Dialog
        busy={isPending}
        className="max-w-5xl"
        open={mode === "create"}
        onClose={() => setMode(null)}
      >
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>สร้างรายการรวบรวมใหม่</DialogTitle>
          <DialogDescription>
            เลือกเดือนและรายการเบิกที่ต้องการรวบรวม
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <DatePicker
              title="เลือกเดือนที่ต้องการรวบรวมรายการเบิก"
              id="create-month"
              kind="month"
              label="เดือน"
              value={collectMonth}
              onValueChange={handleMonthChange}
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
          <LoadingButton
            onClick={submitCreate}
            disabled={isPending || selectedClaimIds.length === 0}
            isLoading={isPending}
            loadingText="กำลังบันทึก"
          >
            บันทึก
          </LoadingButton>
        </DialogFooter>
      </Dialog>

      {/* ─── Edit dialog ──────────────────────────────────────────── */}
      <Dialog
        busy={isPending}
        className="max-w-5xl"
        open={mode === "edit"}
        onClose={() => setMode(null)}
      >
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
          <LoadingButton
            onClick={submitEdit}
            disabled={isPending || selectedClaimIds.length === 0}
            isLoading={isPending}
            loadingText="กำลังบันทึก"
          >
            บันทึก
          </LoadingButton>
        </DialogFooter>
      </Dialog>

      {/* ─── View dialog ──────────────────────────────────────────── */}
      <Dialog
        busy={isPending}
        presentation="drawer"
        className="sm:w-[840px]"
        open={mode === "view"}
        onClose={() => setMode(null)}
      >
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
              <div className="rounded-lg border overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHead>
                    <TableRow className="border-b bg-muted/50">
                      <TableHeader className="py-2 px-3 text-left">
                        ชื่อ-สกุล
                      </TableHeader>
                      <TableHeader className="py-2 px-3 text-left">
                        ตำแหน่ง
                      </TableHeader>
                      <TableHeader className="py-2 px-3 text-right">
                        วัน
                      </TableHeader>
                      <TableHeader className="py-2 px-3 text-right">
                        เงิน
                      </TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selected.expenseClaims.map((claim) => (
                      <TableRow
                        key={claim.id}
                        className="border-b last:border-0"
                      >
                        <TableCell className="py-2 px-3">
                          {claim.claimant.firstName} {claim.claimant.lastName}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground text-xs">
                          {claim.claimantPositionAtSubmission}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right tabular-nums">
                          {decimalText(claim.countDates)}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right tabular-nums">
                          {decimalText(claim.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
        busy={isPending}
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
          <LoadingButton
            onClick={doReview}
            disabled={isPending || (!reviewApproved && !reviewRemark.trim())}
            variant={reviewApproved ? "default" : "destructive"}
            isLoading={isPending}
            loadingText={reviewApproved ? "กำลังอนุมัติ" : "กำลังปฏิเสธ"}
          >
            {reviewApproved ? "ยืนยันการอนุมัติ" : "ยืนยันการปฏิเสธ"}
          </LoadingButton>
        </DialogFooter>
      </Dialog>

      <ConfirmDialog
        open={mode === "cancel"}
        onClose={() => setMode(null)}
        title="ยืนยันการยกเลิก"
        description={
          <>
            ยกเลิกรายการรวบรวมเดือน{" "}
            {selected ? monthDisplay(selected.collectForMonth) : ""}?
            รายการเบิกที่รวบรวมไว้จะถูกคืนสถานะเป็น &quot;รอรวบรวม&quot;
            และจะพร้อมให้ผู้ดูแลเลือกรวบรวมใหม่ได้
          </>
        }
        confirmLabel="ยืนยันการยกเลิก"
        cancelLabel="ไม่ยกเลิก"
        isPending={isPending}
        onConfirm={doCancel}
      />
    </div>
  );
}
