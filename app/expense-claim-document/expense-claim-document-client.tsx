"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Wallet,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createExpenseClaimDocument,
  deleteExpenseClaimDocument,
  getExpenseClaimDocument,
  listEligibleOffSiteWorksForClaim,
  listExpenseClaimDocuments,
  updateExpenseClaimDocument,
} from "@/app/actions/expense-claim-document";
import type {
  EligibleOffSiteWorkOption,
  ExpenseClaimDocumentWithRelations,
  UpdateExpenseClaimDocumentInput,
} from "@/lib/domains/expense-claim-document";
import type { ClaimDocumentStatus, Pagination } from "@/lib/shared/types";
import {
  monthDisplay,
  dateDisplay,
  decimalText,
  toMonthInput,
} from "@/lib/shared/format";
import { claimStatusVariant } from "@/lib/shared/claim-status";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeaderVerificationSection } from "./leader-verification-section";

interface ExpenseClaimDocumentClientProps {
  initialItems: ExpenseClaimDocumentWithRelations[];
  initialPagination: Pagination | null;
  initialViewId: string | null;
  currentUserDisplayName: string;
  currentUserClaimantPositionAtSubmission: string;
}

type Mode = "create" | "edit" | "view" | "delete" | null;

interface FormState {
  expenseMonth: string;
  claimantPositionAtSubmission: string;
  remark: string;
  status: ClaimDocumentStatus;
  countDates: string;
  amount: string;
}

const PAGE_SIZE = 20;
const RATE_PER_DAY = 150;

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
  return new Date(isoDate).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function getMonthDateRange(monthValue: string): { start: Date; end: Date } {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getClaimDatePool(
  selectedOffSiteIds: string[],
  options: EligibleOffSiteWorkOption[],
  monthValue: string,
): { allDates: string[]; weekdayDefaultDates: string[] } {
  const picked = new Set(selectedOffSiteIds);
  const selectedRanges = options.filter((item) => picked.has(item.id));
  const { start: monthStart, end: monthEnd } = getMonthDateRange(monthValue);

  const allDates = new Set<string>();
  const weekdayDefaultDates = new Set<string>();

  for (const item of selectedRanges) {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);

    const effectiveStart = start > monthStart ? start : monthStart;
    const effectiveEnd = end < monthEnd ? end : monthEnd;

    const cursor = new Date(effectiveStart);
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor <= effectiveEnd) {
      const day = cursor.getUTCDay();
      const isoDate = toISODate(cursor);
      allDates.add(isoDate);
      if (day >= 1 && day <= 5) {
        weekdayDefaultDates.add(isoDate);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return {
    allDates: Array.from(allDates).sort(),
    weekdayDefaultDates: Array.from(weekdayDefaultDates).sort(),
  };
}

function getCalendarGridDates(monthValue: string): Array<string | null> {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingEmpty = firstDate.getUTCDay();

  const cells: Array<string | null> = [];
  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toISODate(new Date(Date.UTC(year, month - 1, day))));
  }

  const trailingEmpty = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i += 1) {
    cells.push(null);
  }

  return cells;
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
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] =
    useState<ExpenseClaimDocumentWithRelations | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>({
    expenseMonth: toMonthInput(new Date()),
    claimantPositionAtSubmission: currentUserClaimantPositionAtSubmission,
    remark: "",
    status: "DRAFT",
    countDates: "",
    amount: "",
  });

  const [eligibleOffSiteWorks, setEligibleOffSiteWorks] = useState<
    EligibleOffSiteWorkOption[]
  >([]);
  const [selectedOffSiteWorkIds, setSelectedOffSiteWorkIds] = useState<
    string[]
  >([]);
  const [availableClaimDates, setAvailableClaimDates] = useState<string[]>([]);
  const [selectedClaimDates, setSelectedClaimDates] = useState<string[]>([]);
  const [offSiteSearch, setOffSiteSearch] = useState("");
  const [isLoadingEligibleOffSites, setIsLoadingEligibleOffSites] =
    useState(false);

  useEffect(() => {
    if (!initialViewId) return;

    let cancelled = false;

    const openInitialClaim = async () => {
      const existingItem = initialItems.find(
        (item) => item.id === initialViewId,
      );
      if (existingItem) {
        if (!cancelled) {
          setSelected(existingItem);
          setMode("view");
          router.replace("/expense-claim-document", { scroll: false });
        }
        return;
      }

      const result = await getExpenseClaimDocument(initialViewId);
      if (!cancelled) {
        if (result.success) {
          setSelected(result.data);
          setMode("view");
        } else {
          toast.error("ไม่สามารถเปิดเอกสารเบิกได้", {
            description: result.error,
          });
        }
        router.replace("/expense-claim-document", { scroll: false });
      }
    };

    void openInitialClaim();

    return () => {
      cancelled = true;
    };
  }, [initialItems, initialViewId, router]);

  const dateCount = selectedClaimDates.length;
  const totalAmount = dateCount * RATE_PER_DAY;

  const formValid = useMemo(() => {
    if (!form.expenseMonth) return false;
    if (!form.claimantPositionAtSubmission.trim()) return false;
    return true;
  }, [form]);

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

  const viewMonthValue = useMemo(
    () =>
      selected ? toMonthInput(selected.expenseMonth) : toMonthInput(new Date()),
    [selected],
  );

  const viewCalendarCells = useMemo(
    () => getCalendarGridDates(viewMonthValue),
    [viewMonthValue],
  );

  const viewSelectedDateSet = useMemo(() => {
    const selectedDates = selected?.selectedDates ?? [];
    return new Set(selectedDates.map((value) => value.slice(0, 10)));
  }, [selected]);

  const refresh = useCallback(
    async (nextPage = page, nextSearch = search) => {
      const result = await listExpenseClaimDocuments({
        page: nextPage,
        pageSize: PAGE_SIZE,
        search: nextSearch || undefined,
      });

      if (!result.success) {
        toast.error("ไม่สามารถโหลดข้อมูลได้", { description: result.error });
        return;
      }

      setItems(result.data.data);
      setPagination(result.data.pagination);
      setPage(result.data.pagination.page);
    },
    [page, search],
  );

  const loadEligibleOffSiteWorks = useCallback(async (monthValue: string) => {
    setIsLoadingEligibleOffSites(true);
    const result = await listEligibleOffSiteWorksForClaim(monthValue);
    if (!result.success) {
      toast.error("ไม่สามารถโหลด Off-site Work ได้", {
        description: result.error,
      });
      setEligibleOffSiteWorks([]);
      setSelectedOffSiteWorkIds([]);
      setAvailableClaimDates([]);
      setSelectedClaimDates([]);
      setIsLoadingEligibleOffSites(false);
      return;
    }

    setEligibleOffSiteWorks(result.data);
    setSelectedOffSiteWorkIds([]);
    setAvailableClaimDates([]);
    setSelectedClaimDates([]);
    setIsLoadingEligibleOffSites(false);
  }, []);

  const openCreate = () => {
    const defaultMonth = toMonthInput(new Date());
    setSelected(null);
    setForm({
      expenseMonth: defaultMonth,
      claimantPositionAtSubmission: currentUserClaimantPositionAtSubmission,
      remark: "",
      status: "DRAFT",
      countDates: "",
      amount: "",
    });
    setOffSiteSearch("");
    setEligibleOffSiteWorks([]);
    setSelectedOffSiteWorkIds([]);
    setAvailableClaimDates([]);
    setSelectedClaimDates([]);
    setMode("create");
    void loadEligibleOffSiteWorks(defaultMonth);
  };

  const openEdit = (item: ExpenseClaimDocumentWithRelations) => {
    setSelected(item);
    setForm({
      expenseMonth: toMonthInput(item.expenseMonth),
      claimantPositionAtSubmission: item.claimantPositionAtSubmission,
      remark: item.remark || "",
      status: item.status,
      countDates: decimalText(item.countDates),
      amount: decimalText(item.amount),
    });
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
    startTransition(async () => {
      const result = await createExpenseClaimDocument({
        expenseMonth: toMonthDate(form.expenseMonth),
        claimantPositionAtSubmission: form.claimantPositionAtSubmission.trim(),
        offSiteWorkIds:
          selectedOffSiteWorkIds.length > 0
            ? selectedOffSiteWorkIds
            : undefined,
        selectedDates:
          selectedClaimDates.length > 0 ? selectedClaimDates : undefined,
        countDates: dateCount > 0 ? String(dateCount) : undefined,
        amount: totalAmount > 0 ? String(totalAmount) : undefined,
        remark: form.remark.trim() || undefined,
        status,
      });

      if (!result.success) {
        toast.error("สร้างเอกสารไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success(
        status === "PENDING"
          ? "ส่งเอกสารเรียบร้อย"
          : "บันทึกร่างเอกสารเรียบร้อย",
      );
      await refresh(1, search);
      setMode(null);
    });
  };

  const toUpdatePayload = (): UpdateExpenseClaimDocumentInput => {
    if (!selected) return {};

    return {
      expenseMonth:
        toMonthInput(selected.expenseMonth) !== form.expenseMonth
          ? toMonthDate(form.expenseMonth)
          : undefined,
      claimantPositionAtSubmission:
        selected.claimantPositionAtSubmission !==
        form.claimantPositionAtSubmission
          ? form.claimantPositionAtSubmission.trim()
          : undefined,
      remark:
        (selected.remark || "") !== form.remark
          ? form.remark.trim() || null
          : undefined,
      status: selected.status !== form.status ? form.status : undefined,
      countDates:
        decimalText(selected.countDates) !== form.countDates
          ? form.countDates.trim() || null
          : undefined,
      amount:
        decimalText(selected.amount) !== form.amount
          ? form.amount.trim() || null
          : undefined,
    };
  };

  const submitUpdate = () => {
    if (!selected) return;

    startTransition(async () => {
      const result = await updateExpenseClaimDocument(
        selected.id,
        toUpdatePayload(),
      );

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
      const result = await deleteExpenseClaimDocument(selected.id);

      if (!result.success) {
        toast.error("ยกเลิกเอกสารไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("ยกเลิกเอกสารเรียบร้อย");
      await refresh(page, search);
      setMode(null);
    });
  };

  const submitSearch = () => {
    startTransition(async () => {
      await refresh(1, search);
    });
  };

  const changePage = (nextPage: number) => {
    startTransition(async () => {
      await refresh(nextPage, search);
    });
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-linear-to-r from-emerald-50 via-white to-teal-50 p-6 shadow-sm">
        <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-emerald-100/70 blur-2xl" />
        <div className="absolute -left-10 -bottom-14 h-32 w-32 rounded-full bg-teal-100/60 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Expense Claim Documents
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              จัดการเอกสารเบิกจ่ายแบบสะอาดตา เน้นงานสำคัญและรองรับทุกขนาดหน้าจอ
            </p>
          </div>
          <Button onClick={openCreate} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            สร้างเอกสาร
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเลขที่เอกสาร, หมายเหตุ, หรือชื่อผู้ยื่น"
              className="pl-9"
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{item.id}</p>
                <p className="text-xs text-muted-foreground">
                  {item.claimant.firstName} {item.claimant.lastName}
                </p>
              </div>
              <Badge variant={claimStatusVariant(item.status)}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Badge>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{monthDisplay(item.expenseMonth)}</span>
              </p>
              <p className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span>{decimalText(item.amount)} บาท</span>
              </p>
              <p className="line-clamp-2">{item.remark || "-"}</p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected(item);
                  setMode("view");
                }}
              >
                <Eye className="mr-1 h-4 w-4" />
                ดู
              </Button>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setSelected(item);
                    setMode("delete");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {items.length === 0 && (
        <EmptyState icon={FileText} message="ไม่พบเอกสารเบิกจ่าย" />
      )}

      {pagination && (
        <PaginationControls
          pagination={pagination}
          isPending={isPending}
          onPrevious={() => changePage(page - 1)}
          onNext={() => changePage(page + 1)}
        />
      )}

      <Dialog
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expenseMonth">เดือน</Label>
              <Input
                id="expenseMonth"
                type="month"
                value={form.expenseMonth}
                onChange={(e) => {
                  const nextMonth = e.target.value;
                  setForm((prev) => ({ ...prev, expenseMonth: nextMonth }));
                  if (mode === "create") {
                    void loadEligibleOffSiteWorks(nextMonth);
                  }
                }}
                disabled={mode !== "create"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Input id="owner" value={currentUserDisplayName} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="claimantPositionAtSubmission">
                ตำแหน่งผู้ยื่นขณะยื่นเอกสาร
              </Label>
              <Input
                id="claimantPositionAtSubmission"
                value={form.claimantPositionAtSubmission}
                disabled
              />
            </div>

            {mode === "create" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="offsite-search">OffSiteWork Relateds</Label>
                  <Input
                    id="offsite-search"
                    placeholder="ค้นหา Off-site Work"
                    value={offSiteSearch}
                    onChange={(e) => setOffSiteSearch(e.target.value)}
                  />
                  <div className="max-h-52 overflow-y-auto rounded-md border p-2">
                    {isLoadingEligibleOffSites ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        กำลังโหลด Off-site Work
                      </div>
                    ) : filteredEligibleOptions.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        ไม่พบ Off-site Work ที่เข้าเงื่อนไข
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
                              <div className="min-w-0 text-sm">
                                <p className="font-medium">{offsite.id}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {offsite.innerRefDocumentId ||
                                    "ไม่มีเลขอ้างอิง"}{" "}
                                  | {offsite.location || "-"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {dateDisplay(offsite.startDate)} -{" "}
                                  {dateDisplay(offsite.endDate)}
                                </p>
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
                    Claim Dates (default Mon-Fri, can select all days)
                  </Label>
                  <div className="rounded-md border p-2">
                    {availableClaimDates.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        เลือก Off-site Work ก่อน เพื่อคำนวณวันเบิก
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
                                  className="h-9 rounded-md"
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
                                className={`h-9 rounded-md border text-xs transition ${
                                  selectable
                                    ? checked
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground/30 hover:bg-muted/50"
                                    : "border-transparent text-muted-foreground/30"
                                }`}
                                title={formatDay(cell)}
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="countDates">Date Count</Label>
                    <Input id="countDates" value={String(dateCount)} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Total Amount (THB)</Label>
                    <Input id="amount" value={String(totalAmount)} disabled />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="countDates">จำนวนวัน</Label>
                    <Input
                      id="countDates"
                      inputMode="decimal"
                      value={form.countDates === "-" ? "" : form.countDates}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          countDates: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">จำนวนเงิน</Label>
                    <Input
                      id="amount"
                      inputMode="decimal"
                      value={form.amount === "-" ? "" : form.amount}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, amount: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">สถานะ</Label>
                  <select
                    id="status"
                    aria-label="สถานะเอกสาร"
                    title="สถานะเอกสาร"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as ClaimDocumentStatus,
                      }))
                    }
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PENDING_LEADER_VERIFY">
                      PENDING_LEADER_VERIFY
                    </option>
                    <option value="WAIT_FOR_COLLECTION">
                      WAIT_FOR_COLLECTION
                    </option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="remark">Remark (optional)</Label>
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
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            Cancel
          </Button>

          {mode === "create" ? (
            <>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => submitCreate("DRAFT")}
                disabled={!formValid || isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Draft
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => submitCreate("PENDING")}
                disabled={!formValid || isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Submit
              </Button>
            </>
          ) : (
            <Button onClick={submitUpdate} disabled={!formValid || isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Update
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      <Dialog
        open={mode === "view"}
        onClose={() => setMode(null)}
        className="max-w-3xl"
      >
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>รายละเอียดเอกสาร</DialogTitle>
          <DialogDescription>{selected?.id}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {selected ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">ผู้ยื่น</p>
                <p className="font-medium">
                  <User className="mr-1 inline h-4 w-4" />
                  {selected.claimant.firstName} {selected.claimant.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">เดือน</p>
                <p className="font-medium">
                  {monthDisplay(selected.expenseMonth)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">จำนวนวัน</p>
                <p className="font-medium">
                  {decimalText(selected.countDates)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">จำนวนเงิน</p>
                <p className="font-medium">{decimalText(selected.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">สถานะ</p>
                <Badge variant={claimStatusVariant(selected.status)}>
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">หมายเหตุ</p>
                <p className="font-medium whitespace-pre-wrap">
                  {selected.remark || "-"}
                </p>
              </div>

              {/* Leader verification section */}
              {selected.leaderVerifications &&
              selected.leaderVerifications.length > 0 ? (
                <LeaderVerificationSection
                  verifications={selected.leaderVerifications}
                  claimId={selected.id}
                />
              ) : null}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  วันที่ที่ยื่นเบิก (ปฏิทิน)
                </p>
                <div className="rounded-md border p-2">
                  {viewSelectedDateSet.size === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      ไม่มีวันที่ที่บันทึกไว้
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
                        {viewCalendarCells.map((cell, idx) => {
                          if (!cell) {
                            return (
                              <div
                                key={`view-empty-${idx}`}
                                className="h-9 rounded-md"
                              />
                            );
                          }

                          const checked = viewSelectedDateSet.has(cell);

                          return (
                            <div
                              key={`view-${cell}`}
                              className={`flex h-9 items-center justify-center rounded-md border text-xs ${
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/20 text-muted-foreground"
                              }`}
                              title={formatDay(cell)}
                            >
                              {new Date(cell).getUTCDate()}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        วันที่ที่เลือก: {viewSelectedDateSet.size} วัน
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setMode(null)}
          >
            ปิด
          </Button>
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
