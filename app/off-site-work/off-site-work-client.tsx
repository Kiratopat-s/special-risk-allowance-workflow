"use client";

import { runServerAction } from "@/lib/deployment/client";
import { useWorkflowTransition as useTransition } from "@/lib/hooks/use-workflow-transition";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfImport } from "./pdf-import";
import { employeeKey, employeeListSchema, mergeEmployees, validWorkDate } from "@/lib/domains/off-site-work/employee-list";
import type { PdfField } from "@/lib/pdf/off-site-work-parser";
import { useRouter, useSearchParams } from "next/navigation";
import { updateListQuery } from "@/lib/ui/list-query";
import { useScopedPermission } from "@/lib/hooks/use-scoped-permission";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/workflow-ui/table";
import { toast } from "sonner";
import {
  Eye,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  UserCheck,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/workflow-ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/workflow-ui/button";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { Input } from "@/components/workflow-ui/input";
import { DatePicker } from "@/components/workflow-ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/workflow-ui/textarea";
import {
  createOffSiteWork,
  deleteOffSiteWork,
  listOffSiteWorks,
  updateOffSiteWork,
} from "@/app/actions/off-site-work";
import { searchUsersForLeader } from "@/app/actions/user";
import type {
  OffSiteWorkWithRelations,
  EmployeeListItem,
} from "@/lib/domains/off-site-work";
import type { Pagination } from "@/lib/shared/types";
import { bangkokToday, shortDateDisplay, toDateInputValue } from "@/lib/shared/format";
import { PaginationControls } from "@/components/workflow-ui/pagination-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/workflow-ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface OffSiteWorkClientProps {
  initialItems: OffSiteWorkWithRelations[];
  initialPagination: Pagination | null;
}

type Mode = "create" | "edit" | "view" | "delete" | null;
type LeaderType = "none" | "internal" | "external";

interface LeaderUser {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  position: string | null;
  email: string | null;
}

interface FormState {
  id: string;
  innerRefDocumentId: string;
  startDate: string;
  endDate: string;
  location: string;
  objective: string;
  employeeList: EmployeeListItem[];
  // leader
  leaderType: LeaderType;
  leaderUserId: string;
  leaderEmpId: string;
  leaderFirstName: string;
  leaderLastName: string;
  leaderPosition: string;
  leaderEmail: string;
}

const DEFAULT_PAGE_SIZE = 24;

function nextPrefixId(): string {
  const yy = new Date().getFullYear().toString().slice(-2);
  return `TZ${yy}`;
}

function blankLeader(): Pick<
  FormState,
  | "leaderType"
  | "leaderUserId"
  | "leaderEmpId"
  | "leaderFirstName"
  | "leaderLastName"
  | "leaderPosition"
  | "leaderEmail"
> {
  return {
    leaderType: "none",
    leaderUserId: "",
    leaderEmpId: "",
    leaderFirstName: "",
    leaderLastName: "",
    leaderPosition: "",
    leaderEmail: "",
  };
}

function leaderFromItem(
  item: OffSiteWorkWithRelations,
): Pick<
  FormState,
  | "leaderType"
  | "leaderUserId"
  | "leaderEmpId"
  | "leaderFirstName"
  | "leaderLastName"
  | "leaderPosition"
  | "leaderEmail"
> {
  if (item.leaderUserId) {
    return {
      leaderType: "internal",
      leaderUserId: item.leaderUserId,
      leaderEmpId: item.leaderEmpId || "",
      leaderFirstName: item.leaderFirstName || "",
      leaderLastName: item.leaderLastName || "",
      leaderPosition: item.leaderPosition || "",
      leaderEmail: item.leaderEmail || "",
    };
  }
  if (item.leaderFirstName || item.leaderEmpId) {
    return {
      leaderType: "external",
      leaderUserId: "",
      leaderEmpId: item.leaderEmpId || "",
      leaderFirstName: item.leaderFirstName || "",
      leaderLastName: item.leaderLastName || "",
      leaderPosition: item.leaderPosition || "",
      leaderEmail: item.leaderEmail || "",
    };
  }
  return blankLeader();
}

export function OffSiteWorkClient({
  initialItems,
  initialPagination,
}: OffSiteWorkClientProps) {
  const router = useRouter();
  const query = useSearchParams();
  const { allows, userId } = useScopedPermission("OFF_SITE_WORK");
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
  const [search, setSearch] = useState(query.get("search") || "");
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<OffSiteWorkWithRelations | null>(
    null,
  );
  const [form, setForm] = useState<FormState>({
    id: "",
    innerRefDocumentId: "",
    startDate: "",
    endDate: "",
    location: "",
    objective: "",
    employeeList: [],
    ...blankLeader(),
  });
  const [dirtyFields, setDirtyFields] = useState<PdfField[]>([]);
  const [formSession, setFormSession] = useState(0);
  const [pdfReviewPending, setPdfReviewPending] = useState(false);
  const [isPending, startTransition] = useTransition();

  const updateField = (field: PdfField, value: string) => {
    setDirtyFields((previous) => previous.includes(field) ? previous : [...previous, field]);
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  // Leader user search state
  const [leaderSearch, setLeaderSearch] = useState("");
  const [leaderResults, setLeaderResults] = useState<LeaderUser[]>([]);
  const [leaderSearchPending, startLeaderSearch] = useTransition();
  const [selectedLeaderUser, setSelectedLeaderUser] =
    useState<LeaderUser | null>(null);

  // Employee list search state
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<LeaderUser[]>([]);
  const [empSearchPending, startEmpSearch] = useTransition();

  const validForm = useMemo(() => {
    if (!form.id.trim()) return false;
    if (!validWorkDate(form.startDate) || !validWorkDate(form.endDate)) return false;
    if (!employeeListSchema.safeParse(form.employeeList).success) return false;
    if ([form.id, form.innerRefDocumentId, form.location, form.objective].some((value) => /[\u0000\uFFFD]/.test(value))) return false;
    if (new Date(form.endDate) < new Date(form.startDate)) return false;
    if (form.leaderType === "internal" && !form.leaderUserId) return false;
    if (form.leaderType === "external" && !form.leaderFirstName.trim())
      return false;
    return true;
  }, [form]);

  const refresh = useCallback(
    async (nextPage = page, nextSearch = search) => {
      const result = await runServerAction(() => listOffSiteWorks({
        page: nextPage,
        pageSize: initialPagination?.pageSize ?? DEFAULT_PAGE_SIZE,
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
    [page, search, initialPagination?.pageSize, router],
  );

  const openCreate = () => {
    setDirtyFields([]);
    setPdfReviewPending(false);
    setFormSession((previous) => previous + 1);
    const today = bangkokToday();
    setSelected(null);
    setSelectedLeaderUser(null);
    setLeaderSearch("");
    setLeaderResults([]);
    setEmpSearch("");
    setEmpResults([]);
    setForm({
      id: nextPrefixId(),
      innerRefDocumentId: "",
      startDate: today,
      endDate: today,
      location: "",
      objective: "",
      employeeList: [],
      ...blankLeader(),
    });
    setMode("create");
  };

  const openEdit = (item: OffSiteWorkWithRelations) => {
    setSelected(item);
    const leaderData = leaderFromItem(item);
    const internalUser =
      leaderData.leaderType === "internal" && item.leaderUser
        ? {
            id: item.leaderUser.id,
            employeeId: item.leaderUser.employeeId || null,
            firstName: item.leaderUser.firstName,
            lastName: item.leaderUser.lastName,
            position: item.leaderUser.position || null,
            email: null,
          }
        : null;
    setSelectedLeaderUser(internalUser);
    setLeaderSearch("");
    setLeaderResults([]);
    setEmpSearch("");
    setEmpResults([]);
    setForm({
      id: item.id,
      innerRefDocumentId: item.innerRefDocumentId || "",
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
      location: item.location || "",
      objective: item.objective || "",
      employeeList: item.employeeList ?? [],
      ...leaderData,
    });
    setMode("edit");
  };

  const handleLeaderSearch = () => {
    startLeaderSearch(async () => {
      const res = await runServerAction(() => searchUsersForLeader(leaderSearch));
      if (res === undefined) return;
      if (res.success) {
        setLeaderResults(res.data as LeaderUser[]);
      }
    });
  };

  const handleEmpSearch = () => {
    startEmpSearch(async () => {
      const res = await runServerAction(() => searchUsersForLeader(empSearch));
      if (res === undefined) return;
      if (res.success) {
        setEmpResults(res.data as LeaderUser[]);
      }
    });
  };

  const addEmployee = (u: LeaderUser) => {
    setForm((prev) => {
      if (prev.employeeList.some((e) => e.userId === u.id || (u.employeeId && e.employeeId === u.employeeId))) return prev;
      const newItem: EmployeeListItem = {
        userId: u.id,
        employeeId: u.employeeId,
        firstName: u.firstName,
        lastName: u.lastName,
        position: u.position,
        departmentId: null,
        departmentName: null,
      };
      return { ...prev, employeeList: [...prev.employeeList, newItem] };
    });
    setEmpResults([]);
    setEmpSearch("");
  };

  const removeEmployee = (index: number) => {
    setForm((prev) => ({
      ...prev,
      employeeList: prev.employeeList.filter((_, row) => row !== index),
    }));
  };

  const selectInternalLeader = (u: LeaderUser) => {
    setSelectedLeaderUser(u);
    setForm((prev) => ({
      ...prev,
      leaderUserId: u.id,
      leaderEmpId: u.employeeId || "",
      leaderFirstName: u.firstName,
      leaderLastName: u.lastName,
      leaderPosition: u.position || "",
      leaderEmail: u.email || "",
    }));
    setLeaderResults([]);
    setLeaderSearch("");
  };

  const clearLeader = () => {
    setSelectedLeaderUser(null);
    setLeaderSearch("");
    setLeaderResults([]);
    setForm((prev) => ({
      ...prev,
      ...blankLeader(),
      leaderType: prev.leaderType,
    }));
  };

  function buildLeaderPayload(f: FormState) {
    if (f.leaderType === "none") {
      return {
        leaderUserId: null as string | null,
        leaderEmpId: null as string | null,
        leaderFirstName: null as string | null,
        leaderLastName: null as string | null,
        leaderPosition: null as string | null,
        leaderEmail: null as string | null,
      };
    }
    return {
      leaderUserId: f.leaderType === "internal" ? f.leaderUserId || null : null,
      leaderEmpId: f.leaderEmpId.trim() || null,
      leaderFirstName: f.leaderFirstName.trim() || null,
      leaderLastName: f.leaderLastName.trim() || null,
      leaderPosition: f.leaderPosition.trim() || null,
      leaderEmail: f.leaderEmail.trim() || null,
    };
  }

  const submitCreate = () => {
    startTransition(async () => {
      const result = await runServerAction(() => createOffSiteWork({
        id: form.id.trim(),
        innerRefDocumentId: form.innerRefDocumentId.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        location: form.location.trim() || undefined,
        objective: form.objective.trim() || undefined,
        employeeList:
          form.employeeList.length > 0 ? form.employeeList : undefined,
        ...buildLeaderPayload(form),
      }));
      if (result === undefined) return;

      if (!result.success) {
        toast.error("สร้างรายการไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("สร้างรายการสำเร็จ");
      await refresh(page, search);
      setMode(null);
    });
  };

  const submitEdit = () => {
    if (!selected) return;

    startTransition(async () => {
      const result = await runServerAction(() => updateOffSiteWork(selected.id, {
        innerRefDocumentId:
          form.innerRefDocumentId !== (selected.innerRefDocumentId || "")
            ? form.innerRefDocumentId || null
            : undefined,
        startDate:
          form.startDate !== toDateInputValue(selected.startDate)
            ? form.startDate
            : undefined,
        endDate:
          form.endDate !== toDateInputValue(selected.endDate)
            ? form.endDate
            : undefined,
        location:
          form.location !== (selected.location || "")
            ? form.location || null
            : undefined,
        objective:
          form.objective !== (selected.objective || "")
            ? form.objective || null
            : undefined,
        employeeList: form.employeeList,
        ...buildLeaderPayload(form),
      }));
      if (result === undefined) return;

      if (!result.success) {
        toast.error("อัปเดตรายการไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("อัปเดตรายการสำเร็จ");
      await refresh();
      setMode(null);
    });
  };

  const submitDelete = () => {
    if (!selected) return;

    startTransition(async () => {
      const result = await runServerAction(() => deleteOffSiteWork(selected.id));
      if (result === undefined) return;
      if (!result.success) {
        toast.error("ลบรายการไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("ลบรายการสำเร็จ");
      await refresh();
      setMode(null);
    });
  };

  useEffect(() => {
    if (query.get("create") === "1" && allows("CREATE", userId)) {
      const frame = requestAnimationFrame(() => {
        openCreate();
        const next = new URLSearchParams(query);
        next.delete("create");
        window.history.replaceState(null, "", `/dashboard?${next}`);
      });
      return () => cancelAnimationFrame(frame);
    }
  });

  const onSearch = () => navigateList({ search });
  const changePage = (nextPage: number) =>
    navigateList({ page: nextPage }, false);

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FIELD WORK</div>
          <h1>คำสั่งออกนอกสถานที่</h1>
          <p>
            จัดการเอกสารอ้างอิง ผู้ปฏิบัติงาน
            และหัวหน้างานที่รับรองการปฏิบัติงาน
          </p>
        </div>
        {allows("CREATE", userId) && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            เพิ่มคำสั่ง
          </Button>
        )}
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              startAdornment={<Search className="h-4 w-4 text-muted-foreground" />}
              value={search}
              placeholder="ค้นหาเลขที่เอกสาร, สถานที่ หรือวัตถุประสงค์"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
            />
          </div>
          <Button variant="outline" onClick={onSearch} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ค้นหา"}
          </Button>
        </div>
      </section>

      <section className="document-panel" aria-busy={isPending || undefined}>
        <div className="px-5 py-4 border-b flex justify-between text-sm">
          <strong>คำสั่งปฏิบัติงาน</strong>
          <span className="text-muted-foreground">
            {pagination?.total ?? items.length} รายการ
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table aria-label="คำสั่งออกนอกสถานที่">
            <TableHead>
              <TableRow>
                <TableHeader>คำสั่ง / วัตถุประสงค์</TableHeader>
                <TableHeader>วันที่ปฏิบัติงาน</TableHeader>
                <TableHeader>หัวหน้างาน</TableHeader>
                <TableHeader>ผู้ปฏิบัติงาน</TableHeader>
                <TableHeader>ดำเนินการ</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex gap-3 min-w-56">
                      <div className="document-icon">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="font-semibold line-clamp-2 max-w-80">
                          {item.objective || item.innerRefDocumentId || item.id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.id}
                          {item.innerRefDocumentId
                            ? ` · ${item.innerRefDocumentId}`
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.location || "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {shortDateDisplay(item.startDate)}
                    <br />
                    <span className="text-muted-foreground">
                      ถึง {shortDateDisplay(item.endDate)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.leaderFirstName || item.leaderUser ? (
                      <span>
                        {item.leaderFirstName} {item.leaderLastName}
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">
                        ยังไม่ได้กำหนด
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {item.employeeList?.length ?? 0} คน
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      ผู้สร้าง {item.postedByUser.firstName}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {allows("READ", item.postedByUserId) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`ดูรายละเอียดคำสั่ง ${item.id}`}
                          onClick={() => {
                            setSelected(item);
                            setMode("view");
                          }}
                        >
                          <Eye size={16} />
                        </Button>
                      )}
                      {allows("UPDATE", item.postedByUserId) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`แก้ไขคำสั่ง ${item.id}`}
                          onClick={() => openEdit(item)}
                        >
                          <Pencil size={16} />
                        </Button>
                      )}
                      {allows("DELETE", item.postedByUserId) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label={`ลบคำสั่ง ${item.id}`}
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
          <EmptyState icon={FileText} message="ไม่พบข้อมูลที่ตรงกับเงื่อนไข" />
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

      {/* Create / Edit Dialog */}
      <Dialog
        busy={isPending}
        className="max-w-3xl"
        open={mode === "create" || mode === "edit"}
        onClose={() => setMode(null)}
      >
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "เพิ่มคำสั่งใหม่" : "แก้ไขคำสั่ง"}
          </DialogTitle>
          <DialogDescription>
            กรอกข้อมูลเอกสารคำสั่งออกปฏิบัติงานนอกสถานที่
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {mode === "create" && <PdfImport key={formSession} protectedFields={dirtyFields} currentFields={form} disabled={isPending} onPendingChange={setPdfReviewPending}
              onApply={(fields, employees) => {
                setForm((previous) => ({ ...previous, ...fields, employeeList: mergeEmployees(previous.employeeList, employees) }));
                setDirtyFields((previous) => [...new Set([...previous, ...Object.keys(fields) as PdfField[]])]);
              }} />}
            <div className="space-y-2">
              <Label htmlFor="id">เลขที่เอกสาร</Label>
              <Input
                id="id"
                value={form.id}
                disabled={mode === "edit"}
                onChange={(e) =>
                  updateField("id", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="innerRef">เลขอ้างอิงภายใน</Label>
              <Input
                id="innerRef"
                value={form.innerRefDocumentId}
                onChange={(e) =>
                  updateField("innerRefDocumentId", e.target.value)
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <DatePicker
                  id="startDate"
                  kind="date"
                  label="วันเริ่มต้น"
                  value={form.startDate}
                  onValueChange={(value) =>
                    updateField("startDate", value)
                  }
                />
              </div>
              <div className="space-y-2">
                <DatePicker
                  id="endDate"
                  kind="date"
                  label="วันสิ้นสุด"
                  value={form.endDate}
                  onValueChange={(value) =>
                    updateField("endDate", value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">สถานที่</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) =>
                  updateField("location", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">วัตถุประสงค์</Label>
              <Textarea
                id="objective"
                rows={4}
                value={form.objective}
                onChange={(e) =>
                  updateField("objective", e.target.value)
                }
              />
            </div>

            {/* ─── Employee List Section ─── */}
            <div className="rounded-xl border border-dashed p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  รายชื่อพนักงาน ({form.employeeList.length} คน)
                </span>
              </div>

              {/* Search & add */}
              <div className="flex gap-2">
                <Input
                  placeholder="ค้นหาชื่อ / รหัสพนักงาน"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEmpSearch();
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="ค้นหาพนักงาน"
                  onClick={handleEmpSearch}
                  disabled={empSearchPending}
                >
                  {empSearchPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* Search results */}
              {empSearchPending ? (
                <ul
                  aria-busy="true"
                  className="max-h-40 overflow-y-auto rounded-lg border divide-y text-sm"
                >
                  {Array.from({ length: 3 }).map((_, index) => (
                    <li key={index} className="px-3 py-2">
                      <Skeleton className="mb-2 h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </li>
                  ))}
                </ul>
              ) : empResults.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto rounded-lg border divide-y text-sm">
                  {empResults.map((u) => {
                    const already = form.employeeList.some(
                      (e) => e.userId === u.id || Boolean(u.employeeId && e.employeeId === u.employeeId),
                    );
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={already}
                          className="w-full px-3 py-2 text-left hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => addEmployee(u)}
                        >
                          <span className="font-medium">
                            {u.firstName} {u.lastName}
                          </span>
                          {u.employeeId ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {u.employeeId}
                            </span>
                          ) : null}
                          {u.position ? (
                            <p className="text-xs text-muted-foreground">
                              {u.position}
                            </p>
                          ) : null}
                          {already ? (
                            <span className="ml-2 text-xs text-green-600">
                              เพิ่มแล้ว
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {/* Added employees */}
              {form.employeeList.length > 0 ? (
                <ul className="space-y-1.5">
                  {form.employeeList.map((emp, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        {!emp.userId ? <div className="space-y-2 pr-2">
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">ยังไม่เชื่อมบัญชี · จะเชื่อมตามรหัสพนักงานอัตโนมัติ</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {([ ["employeeId", "รหัสพนักงาน"], ["firstName", "ชื่อ"], ["lastName", "นามสกุล"], ["position", "ตำแหน่ง"], ["departmentName", "สังกัด"] ] as const).map(([field, label]) => <label key={field} className="space-y-1 text-xs">
                              <span>{label}</span><Input aria-label={`${label} ผู้เดินทาง ${index + 1}`} value={emp[field] || ""}
                                onChange={(event) => setForm((previous) => ({ ...previous, employeeList: previous.employeeList.map((entry, row) => row === index ? { ...entry, [field]: event.target.value } : entry) }))} />
                            </label>)}
                          </div>
                        </div> : <span className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </span>}
                        {emp.employeeId ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {emp.employeeId}
                          </span>
                        ) : null}
                        {emp.position ? (
                          <p className="text-xs text-muted-foreground">
                            {emp.position}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeEmployee(index)}
                        aria-label={`ลบ ${emp.firstName} ${emp.lastName} ออกจากรายการ`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ยังไม่มีพนักงานในรายการ
                </p>
              )}
            </div>

            {/* ─── Leader Section ─── */}
            <div className="rounded-xl border border-dashed p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  หัวหน้า/ผู้ควบคุมงาน (ถ้ามี)
                </span>
              </div>

              {/* Type selector */}
              <div className="flex gap-2 flex-wrap">
                {(["none", "internal", "external"] as LeaderType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      clearLeader();
                      setForm((prev) => ({
                        ...prev,
                        ...blankLeader(),
                        leaderType: t,
                      }));
                    }}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      form.leaderType === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t === "none"
                      ? "ไม่มี"
                      : t === "internal"
                        ? "บุคลากรในระบบ"
                        : "บุคคลภายนอก"}
                  </button>
                ))}
              </div>

              {/* Internal: user search */}
              {form.leaderType === "internal" ? (
                <div className="space-y-2">
                  {selectedLeaderUser ? (
                    <div className="flex items-center justify-between rounded-lg border bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm">
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        {selectedLeaderUser.firstName}{" "}
                        {selectedLeaderUser.lastName}
                        {selectedLeaderUser.employeeId
                          ? ` (${selectedLeaderUser.employeeId})`
                          : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => clearLeader()}
                      >
                        เปลี่ยน
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="ค้นหาชื่อ / รหัสพนักงาน"
                          value={leaderSearch}
                          onChange={(e) => setLeaderSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleLeaderSearch();
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="ค้นหาหัวหน้า"
                          onClick={handleLeaderSearch}
                          disabled={leaderSearchPending}
                        >
                          {leaderSearchPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Search className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      {leaderSearchPending ? (
                        <ul
                          aria-busy="true"
                          className="max-h-40 overflow-y-auto rounded-lg border divide-y text-sm"
                        >
                          {Array.from({ length: 3 }).map((_, index) => (
                            <li key={index} className="px-3 py-2">
                              <Skeleton className="mb-2 h-4 w-40" />
                              <Skeleton className="h-3 w-28" />
                            </li>
                          ))}
                        </ul>
                      ) : leaderResults.length > 0 ? (
                        <ul className="max-h-40 overflow-y-auto rounded-lg border divide-y text-sm">
                          {leaderResults.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                                onClick={() => selectInternalLeader(u)}
                              >
                                <span className="font-medium">
                                  {u.firstName} {u.lastName}
                                </span>
                                {u.employeeId ? (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {u.employeeId}
                                  </span>
                                ) : null}
                                {u.position ? (
                                  <p className="text-xs text-muted-foreground">
                                    {u.position}
                                  </p>
                                ) : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {/* External: manual fields */}
              {form.leaderType === "external" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">ชื่อ *</Label>
                      <Input
                        value={form.leaderFirstName}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            leaderFirstName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">นามสกุล</Label>
                      <Input
                        value={form.leaderLastName}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            leaderLastName: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">รหัสพนักงาน</Label>
                      <Input
                        value={form.leaderEmpId}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            leaderEmpId: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">ตำแหน่ง</Label>
                      <Input
                        value={form.leaderPosition}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            leaderPosition: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      อีเมล (สำหรับส่งลิงก์ยืนยัน)
                    </Label>
                    <Input
                      type="email"
                      value={form.leaderEmail}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          leaderEmail: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          {pdfReviewPending && <p className="mr-auto text-xs text-muted-foreground">นำข้อมูลจาก PDF ลงฟอร์มหรือยกเลิกการนำเข้าก่อนบันทึก</p>}
          {!validForm && <p role="status" className="mr-auto text-xs text-amber-800 dark:text-amber-300">กรุณาตรวจเลขเอกสาร วันที่ รายชื่อซ้ำ และแก้ไขอักษร � ให้ครบก่อนบันทึก</p>}
          <Button
            variant="outline"
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <LoadingButton
            disabled={!validForm || isPending || pdfReviewPending}
            isLoading={isPending}
            loadingText={mode === "create" ? "กำลังบันทึก" : "กำลังอัปเดต"}
            onClick={mode === "create" ? submitCreate : submitEdit}
          >
            {mode === "create" ? "บันทึก" : "อัปเดต"}
          </LoadingButton>
        </DialogFooter>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        busy={isPending}
        presentation="drawer"
        open={mode === "view"}
        onClose={() => setMode(null)}
      >
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>รายละเอียดคำสั่ง</DialogTitle>
          <DialogDescription>{selected?.id}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">เลขที่เอกสาร</p>
                <p className="font-medium">{selected.id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ช่วงวันที่</p>
                <p className="font-medium">
                  {shortDateDisplay(selected.startDate)} -{" "}
                  {shortDateDisplay(selected.endDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">สถานที่</p>
                <p className="font-medium">{selected.location || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">วัตถุประสงค์</p>
                <p className="font-medium whitespace-pre-wrap">
                  {selected.objective || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ผู้บันทึก</p>
                <p className="font-medium">
                  {selected.postedByUser.firstName}{" "}
                  {selected.postedByUser.lastName}
                </p>
              </div>
              {selected.leaderFirstName || selected.leaderUser ? (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 space-y-1">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    หัวหน้า/ผู้ควบคุมงาน
                  </p>
                  <p className="font-medium">
                    {selected.leaderFirstName} {selected.leaderLastName}
                  </p>
                  {selected.leaderEmpId ? (
                    <p className="text-xs text-muted-foreground">
                      รหัส: {selected.leaderEmpId}
                    </p>
                  ) : null}
                  {selected.leaderPosition ? (
                    <p className="text-xs text-muted-foreground">
                      {selected.leaderPosition}
                    </p>
                  ) : null}
                  {selected.leaderEmail ? (
                    <p className="text-xs text-muted-foreground">
                      {selected.leaderEmail}
                    </p>
                  ) : null}
                  {selected.leaderUserId ? (
                    <Badge variant="outline" className="text-[10px]">
                      บุคลากรในระบบ
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      บุคคลภายนอก
                    </Badge>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground">
                    หัวหน้า/ผู้ควบคุมงาน
                  </p>
                  <p className="font-medium text-muted-foreground">-</p>
                </div>
              )}

              {/* Employee list */}
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                  <Users className="h-3.5 w-3.5" />
                  รายชื่อพนักงาน ({selected.employeeList?.length ?? 0} คน)
                </p>
                {selected.employeeList && selected.employeeList.length > 0 ? (
                  <ul className="space-y-1.5">
                    {selected.employeeList.map((emp) => (
                      <li
                        key={employeeKey(emp)}
                        className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </span>
                        {!emp.userId && <span className="ml-2 text-xs text-muted-foreground">ยังไม่เชื่อมบัญชี</span>}
                        {emp.employeeId ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {emp.employeeId}
                          </span>
                        ) : null}
                        {emp.position ? (
                          <p className="text-xs text-muted-foreground">
                            {emp.position}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">-</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode(null)}>
            ปิด
          </Button>
        </DialogFooter>
      </Dialog>

      <ConfirmDialog
        open={mode === "delete"}
        onClose={() => setMode(null)}
        title="ยืนยันการลบ"
        description="ข้อมูลจะถูกยกเลิกแบบ soft-delete"
        bodyText={
          <>
            ต้องการลบรายการเลขที่{" "}
            <span className="font-semibold text-foreground">
              {selected?.id}
            </span>{" "}
            ใช่หรือไม่
          </>
        }
        confirmLabel="ยืนยันลบ"
        isPending={isPending}
        onConfirm={submitDelete}
      />
    </div>
  );
}
