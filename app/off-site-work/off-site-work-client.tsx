"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createOffSiteWork,
  deleteOffSiteWork,
  listOffSiteWorks,
  updateOffSiteWork,
} from "@/app/actions/off-site-work";
import type { OffSiteWorkWithRelations } from "@/lib/domains/off-site-work";

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface OffSiteWorkClientProps {
  initialItems: OffSiteWorkWithRelations[];
  initialPagination: Pagination | null;
}

type Mode = "create" | "edit" | "view" | "delete" | null;

interface FormState {
  id: string;
  innerRefDocumentId: string;
  startDate: string;
  endDate: string;
  location: string;
  objective: string;
}

const DEFAULT_PAGE_SIZE = 24;

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInputValue(value: Date | string): string {
  return new Date(value).toISOString().split("T")[0];
}

function nextPrefixId(): string {
  const yy = new Date().getFullYear().toString().slice(-2);
  return `TZ${yy}`;
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
  const [form, setForm] = useState<FormState>({
    id: "",
    innerRefDocumentId: "",
    startDate: "",
    endDate: "",
    location: "",
    objective: "",
  });
  const [isPending, startTransition] = useTransition();

  const validForm = useMemo(() => {
    if (!form.id.trim()) return false;
    if (!form.startDate || !form.endDate) return false;
    return new Date(form.endDate) >= new Date(form.startDate);
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
    setForm({
      id: nextPrefixId(),
      innerRefDocumentId: "",
      startDate: today,
      endDate: today,
      location: "",
      objective: "",
    });
    setMode("create");
  };

  const openEdit = (item: OffSiteWorkWithRelations) => {
    setSelected(item);
    setForm({
      id: item.id,
      innerRefDocumentId: item.innerRefDocumentId || "",
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
      location: item.location || "",
      objective: item.objective || "",
    });
    setMode("edit");
  };

  const submitCreate = () => {
    startTransition(async () => {
      const result = await createOffSiteWork({
        id: form.id.trim(),
        innerRefDocumentId: form.innerRefDocumentId.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        location: form.location.trim() || undefined,
        objective: form.objective.trim() || undefined,
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="group rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                {formatDate(item.startDate)}
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
              <div className="flex items-center gap-1">
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

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-8 w-8 opacity-60" />
          ไม่พบข้อมูลที่ตรงกับเงื่อนไข
        </div>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <section className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">
            หน้า {pagination.page} / {pagination.totalPages} ทั้งหมด{" "}
            {pagination.total} รายการ
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={!pagination.hasPrevious || isPending}
              onClick={() => changePage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!pagination.hasNext || isPending}
              onClick={() => changePage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      <Dialog
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
            disabled={!validForm || isPending}
            onClick={mode === "create" ? submitCreate : submitEdit}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {mode === "create" ? "บันทึก" : "อัปเดต"}
          </Button>
        </DialogFooter>
      </Dialog>

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
                  {formatDate(selected.startDate)} -{" "}
                  {formatDate(selected.endDate)}
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
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode(null)}>
            ปิด
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={mode === "delete"} onClose={() => setMode(null)}>
        <DialogClose onClose={() => setMode(null)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            ยืนยันการลบ
          </DialogTitle>
          <DialogDescription>
            ข้อมูลจะถูกยกเลิกแบบ soft-delete
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">
            ต้องการลบรายการเลขที่{" "}
            <span className="font-semibold text-foreground">
              {selected?.id}
            </span>{" "}
            ใช่หรือไม่
          </p>
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
            variant="destructive"
            onClick={submitDelete}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            ยืนยันลบ
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
