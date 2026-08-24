"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CopyPlus,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createOffSiteWork,
  deleteOffSiteWork,
  listOffSiteWorks,
  updateOffSiteWork,
} from "@/app/actions/off-site-work";
import { searchUsersForLeader } from "@/app/actions/user";
import type {
  OffSiteWorkWithRelations,
  ParticipantListItem,
} from "@/lib/domains/off-site-work";
import type { Pagination } from "@/lib/shared/types";
import { shortDateDisplay, toDateInputValue } from "@/lib/shared/format";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  participantList: ParticipantListItem[];
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
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<OffSiteWorkWithRelations | null>(
    null,
  );
  const [replacementTargetId, setReplacementTargetId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<FormState>({
    id: "",
    innerRefDocumentId: "",
    startDate: "",
    endDate: "",
    location: "",
    objective: "",
    participantList: [],
    ...blankLeader(),
  });
  const [isPending, startTransition] = useTransition();

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
    if (!form.startDate || !form.endDate) return false;
    if (new Date(form.endDate) < new Date(form.startDate)) return false;
    if (form.leaderType === "internal" && !form.leaderUserId) return false;
    if (form.leaderType === "external" && !form.leaderFirstName.trim())
      return false;
    return true;
  }, [form]);

  const refresh = useCallback(
    async (nextPage = page, nextSearch = search) => {
      const result = await listOffSiteWorks({
        page: nextPage,
        pageSize: DEFAULT_PAGE_SIZE,
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

  const openCreate = () => {
    const today = toDateInputValue(new Date());
    setSelected(null);
    setReplacementTargetId(null);
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
      participantList: [],
      ...blankLeader(),
    });
    setMode("create");
  };

  const openReplacement = (item: OffSiteWorkWithRelations) => {
    const leaderData = leaderFromItem(item);
    setSelected(item);
    setReplacementTargetId(item.id);
    setSelectedLeaderUser(
      item.leaderUser
        ? {
            id: item.leaderUser.id,
            employeeId: item.leaderUser.employeeId,
            firstName: item.leaderUser.firstName,
            lastName: item.leaderUser.lastName,
            position: item.leaderUser.position,
            email: item.leaderEmail,
          }
        : null,
    );
    setLeaderSearch("");
    setLeaderResults([]);
    setEmpSearch("");
    setEmpResults([]);
    setForm({
      id: nextPrefixId(),
      innerRefDocumentId: item.innerRefDocumentId || "",
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
      location: item.location || "",
      objective: item.objective || "",
      participantList: item.participantList ?? [],
      ...leaderData,
    });
    setMode("create");
  };

  const openEdit = (item: OffSiteWorkWithRelations) => {
    setSelected(item);
    setReplacementTargetId(null);
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
      participantList: item.participantList ?? [],
      ...leaderData,
    });
    setMode("edit");
  };

  const handleLeaderSearch = () => {
    startLeaderSearch(async () => {
      const res = await searchUsersForLeader(leaderSearch);
      if (res.success) {
        setLeaderResults(res.data as LeaderUser[]);
      }
    });
  };

  const handleEmpSearch = () => {
    startEmpSearch(async () => {
      const res = await searchUsersForLeader(empSearch);
      if (res.success) {
        setEmpResults(res.data as LeaderUser[]);
      }
    });
  };

  const addEmployee = (u: LeaderUser) => {
    setForm((prev) => {
      if (prev.participantList.some((e) => e.userId === u.id)) return prev;
      const newItem: ParticipantListItem = {
        userId: u.id,
        employeeId: u.employeeId,
        firstName: u.firstName,
        lastName: u.lastName,
        position: u.position,
        departmentId: null,
        departmentName: null,
      };
      return { ...prev, participantList: [...prev.participantList, newItem] };
    });
    setEmpResults([]);
    setEmpSearch("");
  };

  const removeEmployee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      participantList: prev.participantList.filter((e) => e.userId !== userId),
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
      const result = await createOffSiteWork({
        id: form.id.trim(),
        innerRefDocumentId: form.innerRefDocumentId.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        location: form.location.trim() || undefined,
        objective: form.objective.trim() || undefined,
        participantUserIds: form.participantList.map((item) => item.userId),
        supersedesId: replacementTargetId,
        ...buildLeaderPayload(form),
      });

      if (!result.success) {
        toast.error("สร้างรายการไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("สร้างรายการสำเร็จ");
      await refresh(1, search);
      setMode(null);
    });
  };

  const submitEdit = () => {
    if (!selected) return;

    startTransition(async () => {
      const result = await updateOffSiteWork(selected.id, {
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
        participantUserIds: form.participantList.map((item) => item.userId),
        ...buildLeaderPayload(form),
      });

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
      const result = await deleteOffSiteWork(selected.id);
      if (!result.success) {
        toast.error("ลบรายการไม่สำเร็จ", { description: result.error });
        return;
      }

      toast.success("ลบรายการสำเร็จ");
      await refresh();
      setMode(null);
    });
  };

  const onSearch = () => {
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
      <section className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-sky-50 via-white to-cyan-50 p-6 shadow-sm">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-cyan-100/70 blur-2xl" />
        <div className="absolute -left-10 -bottom-16 h-32 w-32 rounded-full bg-blue-100/70 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Off-site Work Actions
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              จัดการคำสั่งปฏิบัติงานนอกสถานที่แบบเรียบง่าย อ่านง่าย
              และใช้งานบนมือถือได้ดี
            </p>
          </div>
          <Button onClick={openCreate} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มคำสั่ง
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              placeholder="ค้นหาเลขที่เอกสาร, สถานที่ หรือวัตถุประสงค์"
              className="pl-9"
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

      <section
        aria-busy={isPending || undefined}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {items.map((item) => (
          <article
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={`ดูรายละเอียดคำสั่ง ${item.id}`}
            onClick={() => {
              setSelected(item);
              setMode("view");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelected(item);
                setMode("view");
              }
            }}
            className="group cursor-pointer rounded-2xl border border-border/60 bg-card p-4 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/30 hover:shadow-md focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{item.id}</p>
                {item.innerRefDocumentId ? (
                  <p className="text-xs text-muted-foreground">
                    Ref: {item.innerRefDocumentId}
                  </p>
                ) : null}
              </div>
              <Badge variant="outline" className="text-[11px]">
                <CalendarDays className="mr-1 h-3 w-3" />
                {shortDateDisplay(item.startDate)}
              </Badge>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{item.location || "-"}</span>
              </p>
              <p className="line-clamp-2">{item.objective || "-"}</p>
              <p className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>
                  {item.postedByUser.firstName} {item.postedByUser.lastName}
                </span>
              </p>
              {item.leaderFirstName || item.leaderUser ? (
                <p className="flex items-center gap-2 text-xs">
                  <UserCheck className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                  <span className="text-blue-500 dark:text-blue-400">
                    {item.leaderFirstName} {item.leaderLastName}
                  </span>
                </p>
              ) : null}
              {item.participantList && item.participantList.length > 0 ? (
                <p className="flex items-center gap-2 text-xs">
                  <Users className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-600">
                    {item.participantList.length} คน
                  </span>
                </p>
              ) : null}
              {item.lockedAt ? (
                <Badge variant="warning" className="w-fit">
                  ล็อกหลังส่งคำขอ
                </Badge>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected(item);
                  setMode("view");
                }}
              >
                <Eye className="mr-1 h-4 w-4" />
                ดู
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(item);
                  }}
                  aria-label={`แก้ไขคำสั่ง ${item.id}`}
                  disabled={Boolean(item.lockedAt)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(item);
                    setMode("delete");
                  }}
                  aria-label={`ลบคำสั่ง ${item.id}`}
                  disabled={Boolean(item.lockedAt)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {item.lockedAt ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      openReplacement(item);
                    }}
                    aria-label={`สร้างฉบับทดแทน ${item.id}`}
                    title="สร้างใบนำตัวฉบับทดแทน"
                  >
                    <CopyPlus className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>

      {items.length === 0 && (
        <EmptyState icon={FileText} message="ไม่พบข้อมูลที่ตรงกับเงื่อนไข" />
      )}

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
        open={mode === "create" || mode === "edit"}
        onClose={() => setMode(null)}
      >
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? replacementTargetId
                ? `สร้างฉบับทดแทน ${replacementTargetId}`
                : "เพิ่มคำสั่งใหม่"
              : "แก้ไขคำสั่ง"}
          </DialogTitle>
          <DialogDescription>
            {replacementTargetId
              ? "ตรวจแก้ข้อมูลที่คัดลอกมา เมื่อบันทึกระบบจะยกเลิกการยืนยันของคำขอที่ยังไม่ปิดงาน"
              : "กรอกข้อมูลเอกสารคำสั่งออกปฏิบัติงานนอกสถานที่"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id">เลขที่เอกสาร</Label>
              <Input
                id="id"
                value={form.id}
                disabled={mode === "edit"}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, id: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="innerRef">เลขอ้างอิงภายใน</Label>
              <Input
                id="innerRef"
                value={form.innerRefDocumentId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    innerRefDocumentId: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">วันเริ่มต้น</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">วันสิ้นสุด</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endDate: e.target.value }))
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
                  setForm((prev) => ({ ...prev, location: e.target.value }))
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
                  setForm((prev) => ({ ...prev, objective: e.target.value }))
                }
              />
            </div>

            {/* ─── Employee List Section ─── */}
            <div className="rounded-xl border border-dashed p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  รายชื่อพนักงาน ({form.participantList.length} คน)
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
                  size="sm"
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
                    const already = form.participantList.some(
                      (e) => e.userId === u.id,
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
              {form.participantList.length > 0 ? (
                <ul className="space-y-1.5">
                  {form.participantList.map((emp) => (
                    <li
                      key={emp.userId}
                      className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </span>
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
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeEmployee(emp.userId)}
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
                          size="sm"
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
          <Button
            variant="outline"
            onClick={() => setMode(null)}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <LoadingButton
            disabled={!validForm || isPending}
            isLoading={isPending}
            loadingText={mode === "create" ? "กำลังบันทึก" : "กำลังอัปเดต"}
            onClick={mode === "create" ? submitCreate : submitEdit}
          >
            {mode === "create" ? "บันทึก" : "อัปเดต"}
          </LoadingButton>
        </DialogFooter>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={mode === "view"} onClose={() => setMode(null)}>
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
                  รายชื่อพนักงาน ({selected.participantList?.length ?? 0} คน)
                </p>
                {selected.participantList && selected.participantList.length > 0 ? (
                  <ul className="space-y-1.5">
                    {selected.participantList.map((emp) => (
                      <li
                        key={emp.userId}
                        className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </span>
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
