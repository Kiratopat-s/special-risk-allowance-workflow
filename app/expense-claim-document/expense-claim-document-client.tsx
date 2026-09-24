"use client";

import { runServerAction } from "@/lib/deployment/client";
import { useWorkflowTransition as useTransition } from "@/lib/hooks/use-workflow-transition";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Stepper, Step, StepLabel } from "@mui/material";
import {
  claimCreatePayload,
  claimUpdatePayload,
  type ClaimFormState,
} from "@/lib/ui/claim-payload";
import { getClaimDatePool, getCalendarGridDates } from "@/lib/ui/claim-dates";
import { parseClaimListQuery, updateListQuery } from "@/lib/ui/list-query";
import { useScopedPermission } from "@/lib/hooks/use-scoped-permission";
import { Select as Dropdown } from "@/components/workflow-ui/form-controls";
import { DatePicker } from "@/components/workflow-ui/date-picker";
import { StatusBadge } from "@/components/workflow-ui/status-badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
} from "@/components/workflow-ui/table";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
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
import { Input } from "@/components/workflow-ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/workflow-ui/textarea";
import {
  createExpenseClaimDocument,
  deleteExpenseClaimDocument,
  getExpenseClaimDocument,
  listEligibleOffSiteWorksForClaim,
  listExpenseClaimDocuments,
  submitDraftExpenseClaimDocument,
  updateExpenseClaimDocument,
} from "@/app/actions/expense-claim-document";
import type {
  EligibleOffSiteWorkOption,
  ExpenseClaimDocumentWithRelations,
} from "@/lib/domains/expense-claim-document";
import type { ClaimDocumentStatus, Pagination } from "@/lib/shared/types";
import {
  bangkokCurrentMonth,
  thaiDateFormat,
  monthDisplay,
  dateDisplay,
  decimalText,
  toMonthInput,
} from "@/lib/shared/format";
import { CLAIM_DAILY_RATE, isClaimMutationLocked } from "@/lib/shared/claim-mutation";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/workflow-ui/confirm-dialog";
import { LeaderVerificationSection } from "./leader-verification-section";
import { ClaimDetailContent } from "@/components/expense-claims/claim-detail-content";

interface ExpenseClaimDocumentClientProps {
  initialItems: ExpenseClaimDocumentWithRelations[];
  initialPagination: Pagination | null;
  initialViewId: string | null;
  currentUserDisplayName: string;
  currentUserClaimantPositionAtSubmission: string;
}

type Mode = "create" | "edit" | "view" | "delete" | null;

type FormState = ClaimFormState;

const PAGE_SIZE = 20;

function toMonthDate(monthValue: string): string {
  return `${monthValue}-01`;
}

const STATUS_LABEL: Record<ClaimDocumentStatus, string> = {
  DRAFT: "ร่าง",
  PENDING: "รอดำเนินการ",
  PENDING_LEADER_VERIFY: "รอหัวหน้ายืนยัน",
  WAIT_FOR_COLLECTION: "รอรวบรวม",
  COLLECTED: "รวบรวมแล้ว",
  APPROVED: "อนุมัติ",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

function formatDay(isoDate: string): string {
  return thaiDateFormat(isoDate, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

// ────────────────────────────────────────────────────────────────────────────

export function ExpenseClaimDocumentClient({
  initialItems,
  initialPagination,
  initialViewId,
  currentUserDisplayName,
  currentUserClaimantPositionAtSubmission,
}: ExpenseClaimDocumentClientProps) {
  const router = useRouter();
  const query = useSearchParams();
  const filters = useMemo(
    () => parseClaimListQuery(new URLSearchParams(query)),
    [query],
  );
  const { allows, userId } = useScopedPermission("EXPENSE_CLAIM");
  const [step, setStep] = useState(0);
  const navigateList = (
    changes: Record<string, string | number | undefined>,
    resetPage = true,
  ) =>
    router.push(
      `/dashboard?${updateListQuery(query.toString(), changes, resetPage)}`,
      { scroll: false },
    );
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState(query.get("search") || "");
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] =
    useState<ExpenseClaimDocumentWithRelations | null>(null);
  const [isPending, startTransition] = useTransition();

  // No-leader dialog state
  const [noLeaderDialogOpen, setNoLeaderDialogOpen] = useState(false);
  const [noLeaderOsws, setNoLeaderOsws] = useState<EligibleOffSiteWorkOption[]>(
    [],
  );

  const [form, setForm] = useState<FormState>({
    expenseMonth: bangkokCurrentMonth(),
    claimantPositionAtSubmission: currentUserClaimantPositionAtSubmission,
    remark: "",
  });

  const [eligibleOffSiteWorks, setEligibleOffSiteWorks] = useState<
    EligibleOffSiteWorkOption[]
  >([]);
  const [selectedOffSiteWorkIds, setSelectedOffSiteWorkIds] = useState<
    string[]
  >([]);
  const [availableClaimDates, setAvailableClaimDates] = useState<string[]>([]);
  const [selectedClaimDates, setSelectedClaimDates] = useState<string[]>([]);
  const eligibleRequest = useRef(0);
  const [eligibleLoaded, setEligibleLoaded] = useState(false);
  const [eligibleError, setEligibleError] = useState<string | null>(null);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const [offSiteSearch, setOffSiteSearch] = useState("");
  const [isLoadingEligibleOffSites, setIsLoadingEligibleOffSites] =
    useState(false);

  useEffect(() => {
    if (!initialViewId) return;

    let cancelled = false;

    const openInitialClaim = async () => {
      const result = await runServerAction(() => getExpenseClaimDocument(initialViewId));
      if (result === undefined) return;
      if (!cancelled) {
        if (result.success) {
          setSelected(result.data);
          setMode("view");
        } else {
          toast.error("ไม่สามารถเปิดเอกสารเบิกได้", {
            description: result.error,
          });
        }
      }
    };

    void openInitialClaim();

    return () => {
      cancelled = true;
    };
  }, [initialItems, initialViewId, router]);

  useEffect(() => {
    const restoreDetail = async () => {
      const id = new URLSearchParams(window.location.search).get("claimId");
      if (!id) {
        setMode((current) => (current === "view" ? null : current));
        return;
      }
      const result = await runServerAction(() => getExpenseClaimDocument(id));
      if (result === undefined) return;
      if (result.success) {
        setSelected(result.data);
        setMode("view");
      } else {
        setMode(null);
        toast.error("ไม่สามารถเปิดเอกสารเบิกได้", {
          description: result.error,
        });
      }
    };
    window.addEventListener("popstate", restoreDetail);
    return () => window.removeEventListener("popstate", restoreDetail);
  }, []);

  const dateCount = selectedClaimDates.length;
  const totalAmount = dateCount * CLAIM_DAILY_RATE;

  const formValid = useMemo(() => {
    if (!form.expenseMonth) return false;
    if (!form.claimantPositionAtSubmission.trim()) return false;
    return true;
  }, [form]);

  const hasLeaderlessSelectedOsw = useMemo(
    () =>
      eligibleOffSiteWorks.some(
        (o) => selectedOffSiteWorkIds.includes(o.id) && !o.hasLeader,
      ),
    [eligibleOffSiteWorks, selectedOffSiteWorkIds],
  );

  const filteredEligibleOptions = useMemo(() => {
    const keyword = offSiteSearch.trim().toLowerCase();
    if (!keyword) return eligibleOffSiteWorks;

    return eligibleOffSiteWorks.filter((item) => {
      const haystack = [
        item.id,
        item.innerRefDocumentId || "",
        item.location || "",
        item.objective || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [eligibleOffSiteWorks, offSiteSearch]);

  const calendarCells = useMemo(
    () => getCalendarGridDates(form.expenseMonth),
    [form.expenseMonth],
  );
  const selectableDateSet = useMemo(
    () => new Set(availableClaimDates),
    [availableClaimDates],
  );
  const selectedDateSet = useMemo(
    () => new Set(selectedClaimDates),
    [selectedClaimDates],
  );

  const refresh = useCallback(
    async (nextPage = page, nextSearch = search) => {
      const result = await runServerAction(() => listExpenseClaimDocuments({
        ...filters,
        page: nextPage,
        pageSize: PAGE_SIZE,
        search: nextSearch || undefined,
      }));
      if (result === undefined) return;

      if (!result.success) {
        toast.error("ไม่สามารถโหลดข้อมูลได้", { description: result.error });
        return;
      }

      setItems(result.data.data);
      setPagination(result.data.pagination);
      setPage(result.data.pagination.page);
      router.refresh();
    },
    [page, search, filters, router],
  );

  const loadEligibleOffSiteWorks = useCallback(
    async (
      monthValue: string,
      preSelectedIds?: string[],
      savedDates?: string[] | null,
      claimId?: string,
    ) => {
      const requestId = ++eligibleRequest.current;
      setIsLoadingEligibleOffSites(true);
      setEligibleLoaded(false);
      setEligibleError(null);
      setSelectionWarning(null);
      setEligibleOffSiteWorks([]);
      setSelectedOffSiteWorkIds([]);
      setAvailableClaimDates([]);
      setSelectedClaimDates([]);
      let result: Awaited<ReturnType<typeof listEligibleOffSiteWorksForClaim>> | undefined;
      try {
        result = await runServerAction(() => listEligibleOffSiteWorksForClaim(monthValue, claimId));
      } catch {
        if (requestId !== eligibleRequest.current) return;
        setIsLoadingEligibleOffSites(false);
        setEligibleError("เชื่อมต่อไม่สำเร็จ กรุณาลองโหลดคำสั่งปฏิบัติงานอีกครั้ง");
        return;
      }
      if (requestId !== eligibleRequest.current) return;
      setIsLoadingEligibleOffSites(false);
      if (result === undefined || !result.success) {
        setEligibleError(result?.error || "โหลดคำสั่งปฏิบัติงานไม่สำเร็จ กรุณาลองอีกครั้ง");
        return;
      }

      setEligibleOffSiteWorks(result.data);
      setEligibleLoaded(true);
      const eligibleIds = new Set(result.data.map((work) => work.id));
      const restoredIds = (preSelectedIds || []).filter((id) => eligibleIds.has(id));
      const { allDates } = getClaimDatePool(restoredIds, result.data, monthValue);
      const restoredDates = [...new Set(savedDates || [])].filter((date) => allDates.includes(date)).sort();
      setSelectedOffSiteWorkIds(restoredIds);
      setAvailableClaimDates(allDates);
      setSelectedClaimDates(restoredDates);
      if (claimId && (restoredIds.length !== (preSelectedIds?.length || 0) ||
          restoredDates.length !== (savedDates?.length || 0))) {
        setSelectionWarning("บางคำสั่งหรือวันที่เดิมไม่อยู่ในตัวเลือกของเดือนนี้ กรุณาตรวจสอบก่อนบันทึก");
      } else if (claimId && preSelectedIds?.length && !savedDates?.length) {
        setSelectionWarning("เอกสารเดิมไม่มีวันที่เบิกที่บันทึกไว้ กรุณาเลือกวันที่เพื่อคำนวณจำนวนวันและยอดเบิก");
      }
    },
    [],
  );

  const openCreate = useCallback(() => {
    setStep(0);
    const defaultMonth = bangkokCurrentMonth();
    setSelected(null);
    setForm({
      expenseMonth: defaultMonth,
      claimantPositionAtSubmission: currentUserClaimantPositionAtSubmission,
      remark: "",
    });
    setOffSiteSearch("");
    setEligibleOffSiteWorks([]);
    setSelectedOffSiteWorkIds([]);
    setAvailableClaimDates([]);
    setSelectedClaimDates([]);
    setMode("create");
    void loadEligibleOffSiteWorks(defaultMonth);
  }, [currentUserClaimantPositionAtSubmission, loadEligibleOffSiteWorks]);

  useEffect(() => {
    if (query.get("create") !== "1" || !allows("CREATE", userId)) return;
    const frame = requestAnimationFrame(() => {
      openCreate();
      const next = new URLSearchParams(query);
      next.delete("create");
      window.history.replaceState(null, "", `/dashboard?${next}`);
    });
    return () => cancelAnimationFrame(frame);
  }, [query, allows, userId, openCreate]);

  const openEdit = (item: ExpenseClaimDocumentWithRelations) => {
    if (isClaimMutationLocked(item)) {
      toast.error("เอกสารนี้ถูกล็อก ไม่สามารถแก้ไขได้");
      return;
    }
    setStep(0);
    setSelected(item);
    setForm({
      expenseMonth: toMonthInput(item.expenseMonth),
      claimantPositionAtSubmission: item.claimantPositionAtSubmission,
      remark: item.remark || "",
    });
    setOffSiteSearch("");
    void loadEligibleOffSiteWorks(
      toMonthInput(item.expenseMonth),
      item.expenseClaimOffSiteWorks.map((link) => link.offSiteWorkId),
      item.selectedDates,
      item.id,
    );
    setMode("edit");
  };

  const updateClaimDatePool = useCallback(
    (nextOffSiteIds: string[], monthValue: string) => {
      const { allDates, weekdayDefaultDates } = getClaimDatePool(
        nextOffSiteIds,
        eligibleOffSiteWorks,
        monthValue,
      );
      setAvailableClaimDates(allDates);
      setSelectedClaimDates((prev) => {
        const prevSet = new Set(prev);
        const nextSelected = allDates.filter((date) => prevSet.has(date));
        if (nextSelected.length === 0 && allDates.length > 0) {
          return weekdayDefaultDates.length > 0
            ? weekdayDefaultDates
            : allDates;
        }
        return nextSelected;
      });
    },
    [eligibleOffSiteWorks],
  );

  const toggleOffSiteWork = (offSiteWorkId: string) => {
    setSelectedOffSiteWorkIds((prev) => {
      const hasValue = prev.includes(offSiteWorkId);
      const next = hasValue
        ? prev.filter((id) => id !== offSiteWorkId)
        : [...prev, offSiteWorkId];

      updateClaimDatePool(next, form.expenseMonth);
      return next;
    });
  };

  const toggleClaimDate = (date: string) => {
    setSelectedClaimDates((prev) =>
      prev.includes(date)
        ? prev.filter((d) => d !== date)
        : [...prev, date].sort(),
    );
  };

  const submitCreate = (status: ClaimDocumentStatus) => {
    if (!eligibleLoaded || isLoadingEligibleOffSites || (status !== "DRAFT" && dateCount === 0)) return;
    // Hard-block: when submitting (not saving draft), every selected OSW must have a leader.
    if (status !== "DRAFT" && hasLeaderlessSelectedOsw) {
      const noLeader = eligibleOffSiteWorks.filter(
        (o) => selectedOffSiteWorkIds.includes(o.id) && !o.hasLeader,
      );
      setNoLeaderOsws(noLeader);
      setNoLeaderDialogOpen(true);
      return;
    }

    startTransition(async () => {
      const result = await runServerAction(() => createExpenseClaimDocument(
        claimCreatePayload(
          form,
          selectedOffSiteWorkIds,
          selectedClaimDates,
          status,
        ),
      ));
      if (result === undefined) return;

      if (!result.success) {
        toast.error("สร้างเอกสารไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success(
        result.data.status !== "DRAFT" ? "ส่งเอกสารเรียบร้อย" : "บันทึกร่างเอกสารเรียบร้อย",
      );
      await refresh(page, search);
      setMode(null);
    });
  };

  const toUpdatePayload = () =>
    claimUpdatePayload(
      selected,
      form,
      selectedOffSiteWorkIds,
      selectedClaimDates,
    );

  const submitUpdate = () => {
    if (!selected || isClaimMutationLocked(selected) || !eligibleLoaded || isLoadingEligibleOffSites) return;
    if (selected.status !== "DRAFT" && (dateCount === 0 || hasLeaderlessSelectedOsw)) return;

    startTransition(async () => {
      const result = await runServerAction(() => updateExpenseClaimDocument(
        selected.id,
        toUpdatePayload(),
      ));
      if (result === undefined) return;

      if (!result.success) {
        toast.error("แก้ไขเอกสารไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("อัปเดตเอกสารเรียบร้อย");
      await refresh(page, search);
      setMode(null);
    });
  };

  const submitDelete = () => {
    if (!selected) return;

    startTransition(async () => {
      const result = await runServerAction(() => deleteExpenseClaimDocument(selected.id));
      if (result === undefined) return;

      if (!result.success) {
        toast.error("ยกเลิกเอกสารไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("ยกเลิกเอกสารเรียบร้อย");
      await refresh(page, search);
      setMode(null);
    });
  };

  // Retry-submit from card button (DRAFT items)
  const submitRetry = (item: ExpenseClaimDocumentWithRelations) => {
    // Client-side pre-check: show no-leader dialog if any linked OSW is leaderless
    const noLeader = item.expenseClaimOffSiteWorks.filter(
      (l) => !l.offSiteWork.leaderUserId && !l.offSiteWork.leaderEmail,
    );
    if (noLeader.length > 0) {
      setNoLeaderOsws(
        noLeader.map((l) => ({
          id: l.offSiteWork.id,
          innerRefDocumentId: l.offSiteWork.innerRefDocumentId,
          startDate: l.offSiteWork.startDate,
          endDate: l.offSiteWork.endDate,
          location: l.offSiteWork.location,
          objective: l.offSiteWork.objective,
          hasLeader: false,
          leaderFirstName: l.offSiteWork.leaderFirstName,
          leaderLastName: l.offSiteWork.leaderLastName,
          leaderEmail: l.offSiteWork.leaderEmail,
        })),
      );
      setNoLeaderDialogOpen(true);
      return;
    }

    startTransition(async () => {
      const result = await runServerAction(() => submitDraftExpenseClaimDocument(item.id));
      if (result === undefined) return;
      if (!result.success) {
        toast.error("ส่งเอกสารไม่สำเร็จ", { description: result.error });
        return;
      }
      toast.success("ส่งเอกสารเรียบร้อย");
      await refresh(page, search);
    });
  };

  // Submit from edit dialog for DRAFT: update OSWs first then submit
  const submitAndUpdate = () => {
    if (!selected || !eligibleLoaded || isLoadingEligibleOffSites || dateCount === 0) return;

    // Client-side leader check against current OSW picker selection
    if (hasLeaderlessSelectedOsw) {
      const noLeader = eligibleOffSiteWorks.filter(
        (o) => selectedOffSiteWorkIds.includes(o.id) && !o.hasLeader,
      );
      setNoLeaderOsws(noLeader);
      setNoLeaderDialogOpen(true);
      return;
    }

    startTransition(async () => {
      // Step 1: save updated OSW links
      const updateResult = await runServerAction(() => updateExpenseClaimDocument(
        selected.id,
        toUpdatePayload(),
      ));
      if (updateResult === undefined) return;
      if (!updateResult.success) {
        toast.error("อัปเดตเอกสารไม่สำเร็จ", {
          description: updateResult.error,
        });
        return;
      }

      // Step 2: submit the draft
      const submitResult = await runServerAction(() => submitDraftExpenseClaimDocument(selected.id));
      if (submitResult === undefined) return;
      if (!submitResult.success) {
        toast.error("ส่งเอกสารไม่สำเร็จ", {
          description: submitResult.error,
        });
        return;
      }

      toast.success("ส่งเอกสารเรียบร้อย");
      await refresh(page, search);
      setMode(null);
    });
  };

  const submitSearch = () => navigateList({ search });
  const changePage = (nextPage: number) =>
    navigateList({ page: nextPage }, false);
  const wizard =
    mode === "create" || mode === "edit";
  const closeDetail = () => {
    setMode(null);
    const next = new URLSearchParams(query);
    next.delete("claimId");
    next.delete("view");
    window.history.replaceState(null, "", `/dashboard?${next}`);
  };
  const openDetail = (item: ExpenseClaimDocumentWithRelations) => {
    setSelected(item);
    setMode("view");
    const next = new URLSearchParams(query);
    next.set("claimId", item.id);
    window.history.pushState(null, "", `/dashboard?${next}`);
  };

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DOCUMENTS</div>
          <h1>เอกสารเบิกค่าใช้จ่าย</h1>
          <p>จัดเตรียมเอกสาร ติดตามสถานะ และตรวจสอบรายละเอียดการเบิก</p>
        </div>
        {allows("CREATE", userId) && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            สร้างเอกสาร
          </Button>
        )}
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              startAdornment={<Search className="h-4 w-4 text-muted-foreground" />}
              placeholder="ค้นหาเลขที่เอกสาร, หมายเหตุ, หรือชื่อผู้ยื่น"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
              }}
            />
          </div>
          <Button variant="outline" disabled={isPending} onClick={submitSearch}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ค้นหา"}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-end [&>div>label]:mb-2">
        <div className="w-full sm:w-48">
          <Dropdown
            id="claim-status"
            label="สถานะ"
            value={query.get("status") || ""}
            onValueChange={(value) =>
              navigateList({ status: value, statusGroup: undefined })
            }
            options={[
              { value: "", label: "ทุกสถานะ" },
              ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </div>
        <div className="w-full sm:w-44">
          <DatePicker
            commitOnBlur
            id="claim-month"
            kind="month"
            label="เดือน"
            value={query.get("month") || ""}
            onValueChange={(value) => navigateList({ month: value })}
          />
        </div>
        <div className="w-full sm:w-48">
          <Dropdown
            id="claim-sort"
            label="เรียงลำดับ"
            value={query.get("sort") || ""}
            onValueChange={(value) => navigateList({ sort: value })}
            options={[
              { value: "", label: "ล่าสุด (ค่าเริ่มต้น)" },
              { value: "amount-desc", label: "ยอดเบิกมาก → น้อย" },
              { value: "amount-asc", label: "ยอดเบิกน้อย → มาก" },
            ]}
          />
        </div>
        {(query.get("statusGroup") ||
          query.get("status") ||
          query.get("month") ||
          query.get("sort")) && (
          <Button
            variant="ghost"
            onClick={() =>
              navigateList({
                status: undefined,
                statusGroup: undefined,
                month: undefined,
                sort: undefined,
              })
            }
          >
            ล้างตัวกรอง
          </Button>
        )}
      </div>
      <section className="document-panel" aria-busy={isPending || undefined}>
        <div className="px-5 py-4 border-b flex justify-between text-sm">
          <strong>รายการเอกสาร</strong>
          <span className="text-muted-foreground">
            {pagination?.total ?? items.length} รายการ
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table aria-label="เอกสารเบิกค่าใช้จ่าย">
            <TableHead>
              <TableRow>
                <TableHeader>เอกสาร / ผู้เบิก</TableHeader>
                <TableHeader>เดือน</TableHeader>
                <TableHeader>สถานะ</TableHeader>
                <TableHeader className="text-right">ยอดเบิก (บาท)</TableHeader>
                <TableHeader className="text-right">ดำเนินการ</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-56">
                      <div className="document-icon">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="font-semibold max-w-72 line-clamp-2">
                          {item.expenseClaimOffSiteWorks
                            .map(
                              (link) =>
                                link.offSiteWork.objective ||
                                link.offSiteWork.innerRefDocumentId,
                            )
                            .filter(Boolean)
                            .join(" · ") || item.id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.claimant.firstName} {item.claimant.lastName} ·{" "}
                          {item.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {monthDisplay(item.expenseMonth)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                    {decimalText(item.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {allows("READ", item.userId) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`ดูรายละเอียด ${item.id}`}
                          onClick={() => openDetail(item)}
                        >
                          <Eye size={16} />
                        </Button>
                      )}
                      {item.status === "DRAFT" && !isClaimMutationLocked(item) &&
                        item.userId === userId &&
                        allows("UPDATE", item.userId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`ส่งเอกสาร ${item.id}`}
                            disabled={isPending}
                            onClick={() => submitRetry(item)}
                          >
                            <Send size={16} />
                          </Button>
                        )}
                      {!isClaimMutationLocked(item) &&
                        allows("UPDATE", item.userId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`แก้ไขเอกสาร ${item.id}`}
                            onClick={() => openEdit(item)}
                          >
                            <Pencil size={16} />
                          </Button>
                        )}
                      {!isClaimMutationLocked(item) &&
                        allows("DELETE", item.userId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            aria-label={`ยกเลิกเอกสาร ${item.id}`}
                            onClick={() => {
                              setSelected(item);
                              setMode("delete");
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {items.length === 0 && (
          <EmptyState
            icon={FileText}
            message="ไม่พบเอกสารเบิกจ่ายตามเงื่อนไข"
          />
        )}
      </section>

      {pagination && (
        <PaginationControls
          pagination={pagination}
          isPending={isPending}
          onPrevious={() => changePage(page - 1)}
          onNext={() => changePage(page + 1)}
        />
      )}

      <Dialog
        busy={isPending}
        open={mode === "create" || mode === "edit"}
        onClose={() => setMode(null)}
        className="max-w-4xl"
      >
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "สร้างเอกสาร" : "แก้ไขเอกสาร"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "สร้างเอกสารเบิกจ่ายจาก Off-site Work ที่เกี่ยวข้อง"
              : "แก้ไขข้อมูลเอกสารที่มีอยู่"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {wizard && (
            <Stepper activeStep={step} alternativeLabel className="mb-7">
              {["เดือน / งาน / วันที่", "ข้อมูลผู้เบิก", mode === "edit" && selected?.status !== "DRAFT" ? "ตรวจสอบและบันทึก" : "ตรวจสอบและส่ง"].map(
                (label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ),
              )}
            </Stepper>
          )}
          {mode === "edit" && selected?.status !== "DRAFT" && (
            <p className="mb-4 text-sm text-muted-foreground">หากเปลี่ยนคำสั่งปฏิบัติงาน เดือน หรือวันที่เบิก ระบบจะส่งให้หัวหน้ายืนยันใหม่</p>
          )}
          {wizard && step === 2 && (
            <div className="space-y-5 rounded-xl border p-5 mb-4">
              <h3 className="font-bold">ตรวจสอบก่อนบันทึก</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">เดือนที่เบิก</dt>
                  <dd className="font-semibold mt-1">
                    {monthDisplay(toMonthDate(form.expenseMonth))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ผู้เบิก</dt>
                  <dd className="font-semibold mt-1">
                    {selected
                      ? `${selected.claimant.firstName} ${selected.claimant.lastName}`
                      : currentUserDisplayName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ตำแหน่งขณะยื่น</dt>
                  <dd className="mt-1">{form.claimantPositionAtSubmission}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ยอดเบิก</dt>
                  <dd className="text-xl font-bold text-primary mt-1">
                    {totalAmount.toLocaleString("th-TH")} บาท
                  </dd>
                </div>
              </dl>
              <div className="border-t pt-4 text-sm">
                <p>
                  {selectedOffSiteWorkIds.length} คำสั่ง · {dateCount} วัน × {CLAIM_DAILY_RATE}
                  บาท
                </p>
                <p className="text-muted-foreground mt-2 break-words">
                  {selectedClaimDates.map(formatDay).join(" · ") ||
                    "ยังไม่ได้เลือกวัน"}
                </p>
              </div>
              {form.remark && (
                <p className="text-sm whitespace-pre-wrap">
                  หมายเหตุ: {form.remark}
                </p>
              )}
              {hasLeaderlessSelectedOsw && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ยังมีคำสั่งที่ไม่ได้กำหนดหัวหน้า สามารถบันทึกร่างไว้ก่อนได้
                </p>
              )}
            </div>
          )}
          <div className="space-y-4">
            <div hidden={wizard && step !== 0} className="space-y-2">
              <DatePicker
                id="expenseMonth"
                kind="month"
                label="เดือน"
                value={form.expenseMonth}
                onValueChange={(nextMonth) => {
                  setForm((prev) => ({ ...prev, expenseMonth: nextMonth }));
                  void loadEligibleOffSiteWorks(nextMonth, undefined, undefined, mode === "edit" ? selected?.id : undefined);
                }}
                disabled={isPending}
              />
            </div>

            <div hidden={wizard && step !== 1} className="space-y-2">
              <Label htmlFor="owner">ผู้เบิก</Label>
              <Input
                id="owner"
                value={
                  selected
                    ? `${selected.claimant.firstName} ${selected.claimant.lastName}`
                    : currentUserDisplayName
                }
                disabled
              />
            </div>

            <div hidden={wizard && step !== 1} className="space-y-2">
              <Label htmlFor="claimantPositionAtSubmission">
                ตำแหน่งผู้ยื่นขณะยื่นเอกสาร
              </Label>
              <Input
                id="claimantPositionAtSubmission"
                value={form.claimantPositionAtSubmission}
                disabled
              />
            </div>

              <div hidden={step !== 0} className="space-y-4">
                {hasLeaderlessSelectedOsw && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      ใบสั่งปฏิบัติงานที่เลือกบางรายการยังไม่มีหัวหน้า
                      กรุณากำหนดหัวหน้าก่อนส่ง
                    </span>
                  </div>
                )}

                {selectionWarning && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{selectionWarning}</p>}
                {eligibleError && (
                  <div role="alert" className="space-y-2 text-sm text-destructive">
                    <p>{eligibleError}</p>
                    <Button variant="outline" onClick={() => void loadEligibleOffSiteWorks(
                      form.expenseMonth,
                      selected?.expenseClaimOffSiteWorks.map((link) => link.offSiteWorkId),
                      selected?.selectedDates,
                      mode === "edit" ? selected?.id : undefined,
                    )}>ลองโหลดอีกครั้ง</Button>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="offsite-search">
                    คำสั่งปฏิบัติงานที่เกี่ยวข้อง
                  </Label>
                  <Input
                    id="offsite-search"
                    placeholder="ค้นหาคำสั่งปฏิบัติงาน"
                    value={offSiteSearch}
                    onChange={(e) => setOffSiteSearch(e.target.value)}
                  />
                  <div
                    aria-busy={isLoadingEligibleOffSites || undefined}
                    className="max-h-52 overflow-y-auto rounded-md border p-2"
                  >
                    {isLoadingEligibleOffSites ? (
                      <div className="space-y-2 p-1">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 rounded-md border px-2 py-2"
                          >
                            <Skeleton className="mt-0.5 h-4 w-4 rounded" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <Skeleton className="h-4 w-36" />
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-28" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredEligibleOptions.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        ไม่พบคำสั่งปฏิบัติงานที่เข้าเงื่อนไข
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {filteredEligibleOptions.map((offsite) => {
                          const checked = selectedOffSiteWorkIds.includes(
                            offsite.id,
                          );
                          return (
                            <button
                              key={offsite.id}
                              type="button"
                              onClick={() => toggleOffSiteWork(offsite.id)}
                              className="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left hover:bg-muted/40"
                            >
                              <div
                                className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${
                                  checked
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/30"
                                }`}
                              >
                                {checked ? <Check className="h-3 w-3" /> : null}
                              </div>
                              <div className="min-w-0 flex-1 text-sm">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-medium">
                                    {offsite.innerRefDocumentId || offsite.id}
                                  </p>
                                  {!offsite.hasLeader && (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                      ยังไม่มีหัวหน้า
                                    </span>
                                  )}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                  {offsite.location || "-"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {dateDisplay(offsite.startDate)} -{" "}
                                  {dateDisplay(offsite.endDate)}
                                </p>
                                {offsite.hasLeader &&
                                  (offsite.leaderFirstName ||
                                    offsite.leaderLastName) && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                      หัวหน้า: {offsite.leaderFirstName}{" "}
                                      {offsite.leaderLastName}
                                      {offsite.leaderEmail
                                        ? ` (${offsite.leaderEmail})`
                                        : ""}
                                    </p>
                                  )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    วันที่เบิก (เริ่มต้นวันจันทร์–ศุกร์ และเลือกวันอื่นได้)
                  </Label>
                  <div className="rounded-md border p-2">
                    {availableClaimDates.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        เลือกคำสั่งปฏิบัติงานก่อน เพื่อคำนวณวันเบิก
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                          <span>Sun</span>
                          <span>Mon</span>
                          <span>Tue</span>
                          <span>Wed</span>
                          <span>Thu</span>
                          <span>Fri</span>
                          <span>Sat</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {calendarCells.map((cell, idx) => {
                            if (!cell) {
                              return (
                                <div
                                  key={`empty-${idx}`}
                                  className="h-11 rounded-md"
                                />
                              );
                            }

                            const selectable = selectableDateSet.has(cell);
                            const checked = selectedDateSet.has(cell);

                            return (
                              <button
                                key={cell}
                                type="button"
                                onClick={() =>
                                  selectable && toggleClaimDate(cell)
                                }
                                disabled={!selectable}
                                className={`h-11 rounded-md border text-sm transition ${
                                  selectable
                                    ? checked
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground/30 hover:bg-muted/50"
                                    : "border-transparent text-muted-foreground/30"
                                }`}
                                title={formatDay(cell)}
                                aria-label={formatDay(cell)}
                                aria-pressed={checked}
                              >
                                {new Date(cell).getUTCDate()}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          วันที่ที่เลือก: {selectedClaimDates.length} วัน
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <p id="claim-totals-help" className="text-sm text-muted-foreground">จำนวนวันและยอดเบิกคำนวณจากวันที่เลือก วันละ {CLAIM_DAILY_RATE} บาท</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="countDates">จำนวนวันที่เลือก</Label>
                    <Input id="countDates" value={String(dateCount)} readOnly aria-describedby="claim-totals-help" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">ยอดเบิก (บาท)</Label>
                    <Input id="amount" value={String(totalAmount)} readOnly aria-describedby="claim-totals-help" />
                  </div>
                </div>
              </div>

            <div hidden={wizard && step !== 1} className="space-y-2">
              <Label htmlFor="remark">หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                id="remark"
                rows={3}
                value={form.remark}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remark: e.target.value }))
                }
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          {wizard && step > 0 && (
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => setStep(step - 1)}
            >
              ย้อนกลับ
            </Button>
          )}
          <Button
            variant="outline"
            className={wizard && step > 0 ? "hidden" : "shrink-0"}
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            ปิด
          </Button>

          {mode === "create" ? (
            <>
              <LoadingButton
                variant="secondary"
                className="shrink-0"
                onClick={() => submitCreate("DRAFT")}
                disabled={!formValid || isPending || !eligibleLoaded || isLoadingEligibleOffSites}
                isLoading={isPending}
                loadingText="กำลังบันทึกร่าง"
              >
                บันทึกร่าง
              </LoadingButton>
              <LoadingButton
                className={step === 2 ? "shrink-0" : "hidden"}
                onClick={() => submitCreate("PENDING_LEADER_VERIFY")}
                disabled={
                  !formValid ||
                  isPending ||
                  hasLeaderlessSelectedOsw ||
                  !eligibleLoaded || isLoadingEligibleOffSites || dateCount === 0 ||
                  step !== 2 ||
                  (selected !== null && selected.userId !== userId)
                }
                isLoading={isPending}
                loadingText="กำลังส่ง"
              >
                ส่งเอกสาร
              </LoadingButton>
            </>
          ) : mode === "edit" && selected?.status === "DRAFT" ? (
            <>
              <LoadingButton
                variant="secondary"
                className="shrink-0"
                onClick={submitUpdate}
                disabled={!formValid || isPending || !eligibleLoaded || isLoadingEligibleOffSites}
                isLoading={isPending}
                loadingText="กำลังบันทึกร่าง"
              >
                บันทึกร่าง
              </LoadingButton>
              <LoadingButton
                className={step === 2 ? "shrink-0" : "hidden"}
                onClick={submitAndUpdate}
                disabled={
                  !formValid ||
                  isPending ||
                  hasLeaderlessSelectedOsw ||
                  !eligibleLoaded || isLoadingEligibleOffSites || dateCount === 0 ||
                  step !== 2 ||
                  (selected !== null && selected.userId !== userId)
                }
                isLoading={isPending}
                loadingText="กำลังส่ง"
              >
                ส่งเอกสาร
              </LoadingButton>
            </>
          ) : (
            <LoadingButton
              className={step === 2 ? "shrink-0" : "hidden"}
              onClick={submitUpdate}
              disabled={!formValid || isPending || !eligibleLoaded || isLoadingEligibleOffSites || hasLeaderlessSelectedOsw || dateCount === 0 || step !== 2}
              isLoading={isPending}
              loadingText="กำลังบันทึก"
            >
              บันทึกการแก้ไข
            </LoadingButton>
          )}
          {wizard && step < 2 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!formValid || isPending || !eligibleLoaded || isLoadingEligibleOffSites}
            >
              ถัดไป
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* No-leader dialog — rendered after create/edit dialog so it stacks on top */}
      <Dialog
        busy={isPending}
        open={noLeaderDialogOpen}
        onClose={() => setNoLeaderDialogOpen(false)}
        className="max-w-md"
      >
        <DialogClose onClose={() => setNoLeaderDialogOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            ใบสั่งปฏิบัติงานยังไม่มีหัวหน้า
          </DialogTitle>
          <DialogDescription>
            ไม่สามารถส่งเอกสารได้จนกว่าใบสั่งต่อไปนี้จะได้รับการกำหนดหัวหน้า
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="space-y-2">
            {noLeaderOsws.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm"
              >
                <p className="font-medium font-mono text-xs">
                  {o.innerRefDocumentId ?? o.id}
                </p>
                {o.location && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {o.location}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            กรุณาไปที่หน้า{" "}
            <Link
              href="/dashboard?tab=off-site-work"
              className="font-medium text-sky-600 dark:text-sky-400 underline underline-offset-2"
              onClick={() => setNoLeaderDialogOpen(false)}
            >
              จัดการใบสั่งปฏิบัติงาน
            </Link>{" "}
            แล้วกำหนดหัวหน้าให้ครบก่อนส่ง หรือบันทึกเป็นร่างไว้ก่อน
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setNoLeaderDialogOpen(false)}
          >
            ปิด
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        busy={isPending}
        open={mode === "view"}
        presentation="drawer"
        onClose={closeDetail}
        className="max-w-3xl"
      >
        <DialogClose onClose={closeDetail} />
        <DialogHeader>
          <DialogTitle>รายละเอียดเอกสาร</DialogTitle>
          <DialogDescription>{selected?.id}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {selected ? (
            <ClaimDetailContent claim={selected}>
              {selected.leaderVerifications &&
              selected.leaderVerifications.length > 0 ? (
                <LeaderVerificationSection
                  verifications={selected.leaderVerifications}
                  claimId={selected.id}
                />
              ) : null}
            </ClaimDetailContent>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={closeDetail}
          >
            ปิด
          </Button>
          {selected && selected.status !== "CANCELLED" && (
            <Button asChild>
              <a href={`/expense-claim-document/${selected.id}/print`} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" />
                ดูตัวอย่างใบคำขอ
              </a>
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      <ConfirmDialog
        open={mode === "delete"}
        onClose={() => setMode(null)}
        title="ยืนยันการยกเลิกเอกสาร"
        description="ระบบจะทำ soft-delete โดยเปลี่ยนสถานะเป็น CANCELLED"
        bodyText={
          <>
            ต้องการยกเลิกเอกสาร{" "}
            <span className="font-semibold text-foreground">
              {selected?.id}
            </span>{" "}
            ใช่หรือไม่
          </>
        }
        confirmLabel="ยืนยันยกเลิก"
        isPending={isPending}
        onConfirm={submitDelete}
      />
    </div>
  );
}
