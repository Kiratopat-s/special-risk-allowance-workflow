"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Calendar,
  FileText,
  User,
  AlertTriangle,
  ClipboardList,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  UserPlus,
} from "lucide-react";
import {
  listOffSiteWorks,
  createOffSiteWork,
  updateOffSiteWork,
  deleteOffSiteWork,
} from "@/app/actions/off-site-work";
import { listActiveUsers } from "@/app/actions/user";
import type {
  OffSiteWorkWithRelations,
  EmployeeListItem,
} from "@/lib/domains/off-site-work";

// =============================================================================
// TYPES
// =============================================================================

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

type DialogMode = "create" | "edit" | "delete" | "view" | null;

interface FormData {
  id: string;
  innerRefDocumentId: string;
  startDate: string;
  endDate: string;
  objective: string;
  location: string;
  employeeList: EmployeeListItem[];
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

function generateId(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  return `TZ${y}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OffSiteWorkClient({
  initialItems,
  initialPagination,
}: OffSiteWorkClientProps) {
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedItem, setSelectedItem] =
    useState<OffSiteWorkWithRelations | null>(null);
  const [formData, setFormData] = useState<FormData>({
    id: "",
    innerRefDocumentId: "",
    startDate: "",
    endDate: "",
    objective: "",
    location: "",
    employeeList: [],
  });
  const [isPending, startTransition] = useTransition();
  const [availableUsers, setAvailableUsers] = useState<EmployeeListItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Load users when dialog opens
  useEffect(() => {
    if (dialogMode === "create" || dialogMode === "edit") {
      let didCancel = false;

      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        const result = await listActiveUsers();
        if (!didCancel) {
          if (result.success) {
            setAvailableUsers(result.data);
          }
          setIsLoadingUsers(false);
        }
      };

      fetchUsers();

      return () => {
        didCancel = true;
      };
    }
  }, [dialogMode]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const refreshData = useCallback(
    async (page = currentPage) => {
      const result = await listOffSiteWorks({
        search: search || undefined,
        page,
        pageSize: 50,
      });
      if (result.success) {
        setItems(result.data.data);
        setPagination(result.data.pagination);
      }
    },
    [search, currentPage],
  );

  const handleSearch = () => {
    setCurrentPage(1);
    startTransition(async () => {
      await refreshData(1);
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    startTransition(async () => {
      await refreshData(page);
    });
  };

  // ---------------------------------------------------------------------------
  // Dialog management
  // ---------------------------------------------------------------------------
  const openCreateDialog = () => {
    setFormData({
      id: generateId(),
      innerRefDocumentId: "",
      startDate: formatDateInput(new Date()),
      endDate: formatDateInput(new Date()),
      objective: "",
      location: "",
      employeeList: [],
    });
    setSelectedItem(null);
    setEmployeeSearch("");
    setDialogMode("create");
  };

  const openEditDialog = (item: OffSiteWorkWithRelations) => {
    const employees = item.employeeList
      ? Array.isArray(item.employeeList)
        ? item.employeeList
        : []
      : [];
    setFormData({
      id: item.id,
      innerRefDocumentId: item.innerRefDocumentId || "",
      startDate: formatDateInput(item.startDate),
      endDate: formatDateInput(item.endDate),
      objective: item.objective || "",
      location: item.location || "",
      employeeList: employees as EmployeeListItem[],
    });
    setSelectedItem(item);
    setEmployeeSearch("");
    setDialogMode("edit");
  };

  const openDeleteDialog = (item: OffSiteWorkWithRelations) => {
    setSelectedItem(item);
    setDialogMode("delete");
  };

  const openViewDialog = (item: OffSiteWorkWithRelations) => {
    setSelectedItem(item);
    setDialogMode("view");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedItem(null);
  };

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------
  const handleCreate = () => {
    startTransition(async () => {
      const result = await createOffSiteWork({
        id: formData.id,
        innerRefDocumentId: formData.innerRefDocumentId || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        objective: formData.objective || undefined,
        location: formData.location || undefined,
        employeeList:
          formData.employeeList.length > 0 ? formData.employeeList : undefined,
      });

      if (result.success) {
        toast.success("บันทึกสำเร็จ", {
          description: `หนังสือเดินทาง ${formData.id} ถูกสร้างเรียบร้อย`,
        });
        await refreshData(1);
        closeDialog();
      } else {
        toast.error("ไม่สามารถสร้างได้", { description: result.error });
      }
    });
  };

  const handleUpdate = () => {
    if (!selectedItem) return;

    const existingEmployees = selectedItem.employeeList
      ? Array.isArray(selectedItem.employeeList)
        ? selectedItem.employeeList
        : []
      : [];
    const employeesChanged =
      JSON.stringify(formData.employeeList) !==
      JSON.stringify(existingEmployees);

    startTransition(async () => {
      const result = await updateOffSiteWork(selectedItem.id, {
        innerRefDocumentId:
          formData.innerRefDocumentId !==
          (selectedItem.innerRefDocumentId || "")
            ? formData.innerRefDocumentId || null
            : undefined,
        startDate:
          formData.startDate !== formatDateInput(selectedItem.startDate)
            ? formData.startDate
            : undefined,
        endDate:
          formData.endDate !== formatDateInput(selectedItem.endDate)
            ? formData.endDate
            : undefined,
        objective:
          formData.objective !== (selectedItem.objective || "")
            ? formData.objective || null
            : undefined,
        location:
          formData.location !== (selectedItem.location || "")
            ? formData.location || null
            : undefined,
        employeeList: employeesChanged
          ? formData.employeeList.length > 0
            ? formData.employeeList
            : null
          : undefined,
      });

      if (result.success) {
        toast.success("แก้ไขสำเร็จ", {
          description: `หนังสือเดินทาง ${selectedItem.id} ถูกอัปเดตเรียบร้อย`,
        });
        await refreshData();
        closeDialog();
      } else {
        toast.error("ไม่สามารถแก้ไขได้", { description: result.error });
      }
    });
  };

  const handleDelete = () => {
    if (!selectedItem) return;

    startTransition(async () => {
      const result = await deleteOffSiteWork(selectedItem.id);

      if (result.success) {
        toast.success("ลบสำเร็จ", {
          description: `หนังสือเดินทาง ${selectedItem.id} ถูกลบเรียบร้อย`,
        });
        await refreshData();
        closeDialog();
      } else {
        toast.error("ไม่สามารถลบได้", { description: result.error });
      }
    });
  };

  const isFormValid =
    formData.id.trim().length > 0 &&
    formData.startDate.length > 0 &&
    formData.endDate.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            คำสั่งออกปฏิบัติงานนอกสถานที่
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการหนังสือคำสั่งเดินทางไปราชการ
          </p>
        </div>
        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มรายการ
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาเลขที่, สถานที่, วัตถุประสงค์..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={handleSearch} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ค้นหา"}
        </Button>
      </div>

      {/* Cards Grid (mobile) / Table (desktop) */}
      {/* ---- MOBILE CARDS ---- */}
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm"
          >
            {/* Top row: ID + badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="font-semibold text-sm leading-tight">{item.id}</p>
                {item.innerRefDocumentId && (
                  <p className="text-xs text-muted-foreground">
                    เลขอ้างอิง: {item.innerRefDocumentId}
                  </p>
                )}
              </div>
              <Badge variant="default" className="shrink-0 text-[10px]">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(item.startDate)}
              </Badge>
            </div>

            {/* Details */}
            <div className="space-y-1.5 text-sm text-muted-foreground">
              {item.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </div>
              )}
              {item.objective && (
                <div className="flex items-start gap-2">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{item.objective}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {item.postedByUser.firstName} {item.postedByUser.lastName}
                </span>
              </div>
              {item.employeeList &&
              Array.isArray(item.employeeList) &&
              (item.employeeList as EmployeeListItem[]).length > 0 ? (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {(item.employeeList as EmployeeListItem[]).length} คน
                  </span>
                </div>
              ) : null}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {formatDate(item.startDate)} — {formatDate(item.endDate)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 pt-1 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => openViewDialog(item)}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                ดู
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => openEditDialog(item)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                แก้ไข
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs text-destructive hover:text-destructive"
                onClick={() => openDeleteDialog(item)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                ลบ
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">ไม่พบข้อมูลคำสั่งออกปฏิบัติงาน</p>
          </div>
        )}
      </div>

      {/* ---- DESKTOP TABLE ---- */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left font-medium p-3">เลขที่เอกสาร</th>
              <th className="text-left font-medium p-3">วัตถุประสงค์</th>
              <th className="text-left font-medium p-3">สถานที่</th>
              <th className="text-center font-medium p-3">ช่วงวันที่</th>
              <th className="text-center font-medium p-3 hidden lg:table-cell">
                ผู้ปฏิบัติงาน
              </th>
              <th className="text-left font-medium p-3 hidden lg:table-cell">
                ผู้บันทึก
              </th>
              <th className="text-left font-medium p-3 hidden xl:table-cell">
                ไฟล์แนบ
              </th>
              <th className="text-right font-medium p-3">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                {/* ID */}
                <td className="p-3">
                  <div>
                    <p className="font-medium">{item.id}</p>
                    {item.innerRefDocumentId && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        อ้างอิง: {item.innerRefDocumentId}
                      </p>
                    )}
                  </div>
                </td>

                {/* Objective */}
                <td className="p-3 max-w-50">
                  <p className="truncate text-muted-foreground">
                    {item.objective || "—"}
                  </p>
                </td>

                {/* Location */}
                <td className="p-3 max-w-50">
                  {item.location ? (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* Date range */}
                <td className="p-3 text-center">
                  <div className="inline-flex flex-col items-center gap-0.5">
                    <Badge variant="outline" className="text-[11px]">
                      {formatDate(item.startDate)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      ถึง
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {formatDate(item.endDate)}
                    </Badge>
                  </div>
                </td>

                {/* Employees */}
                <td className="p-3 text-center hidden lg:table-cell">
                  {item.employeeList &&
                  Array.isArray(item.employeeList) &&
                  (item.employeeList as EmployeeListItem[]).length > 0 ? (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {(item.employeeList as EmployeeListItem[]).length}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>

                {/* Posted by */}
                <td className="p-3 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {item.postedByUser.firstName[0]}
                    </div>
                    <div>
                      <p className="text-xs font-medium leading-tight">
                        {item.postedByUser.firstName}{" "}
                        {item.postedByUser.lastName}
                      </p>
                      {item.postedByUser.employeeId && (
                        <p className="text-[10px] text-muted-foreground">
                          {item.postedByUser.employeeId}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* File */}
                <td className="p-3 hidden xl:table-cell">
                  {item.originalFile ? (
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs truncate max-w-25">
                        {item.originalFile.fileName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>

                {/* Actions */}
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openViewDialog(item)}
                      title="ดูรายละเอียด"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(item)}
                      title="แก้ไข"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(item)}
                      title="ลบ"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-16 text-muted-foreground"
                >
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>ไม่พบข้อมูลคำสั่งออกปฏิบัติงาน</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            แสดง {items.length} จาก {pagination.total} รายการ
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrevious || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-3 text-muted-foreground">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNext || isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CREATE / EDIT DIALOG                                               */}
      {/* ================================================================= */}
      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
      >
        <DialogClose onClose={closeDialog} />
        <DialogHeader>
          <DialogTitle>
            {dialogMode === "create"
              ? "เพิ่มคำสั่งออกปฏิบัติงาน"
              : "แก้ไขคำสั่งออกปฏิบัติงาน"}
          </DialogTitle>
          <DialogDescription>
            {dialogMode === "create"
              ? "กรอกข้อมูลหนังสือคำสั่งเดินทางไปราชการ"
              : "อัปเดตข้อมูลหนังสือคำสั่ง"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {/* Document ID */}
            <div className="space-y-2">
              <Label htmlFor="docId">
                เลขที่เอกสาร <span className="text-destructive">*</span>
              </Label>
              <Input
                id="docId"
                placeholder="เช่น TZ26002144"
                value={formData.id}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, id: e.target.value }))
                }
                disabled={dialogMode === "edit"}
                autoFocus={dialogMode === "create"}
              />
              {dialogMode === "edit" && (
                <p className="text-xs text-muted-foreground">
                  ไม่สามารถแก้ไขเลขที่เอกสารได้
                </p>
              )}
            </div>

            {/* Inner Ref */}
            <div className="space-y-2">
              <Label htmlFor="innerRef">เลขที่อ้างอิงภายใน</Label>
              <Input
                id="innerRef"
                placeholder="(ไม่บังคับ)"
                value={formData.innerRefDocumentId}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    innerRefDocumentId: e.target.value,
                  }))
                }
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">
                  วันเริ่มต้น <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">
                  วันสิ้นสุด <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, endDate: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">สถานที่</Label>
              <Input
                id="location"
                placeholder="เช่น จ.เชียงใหม่ อ.เมือง"
                value={formData.location}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, location: e.target.value }))
                }
              />
            </div>

            {/* Objective */}
            <div className="space-y-2">
              <Label htmlFor="objective">วัตถุประสงค์</Label>
              <Textarea
                id="objective"
                placeholder="ระบุวัตถุประสงค์การเดินทาง..."
                value={formData.objective}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, objective: e.target.value }))
                }
                rows={3}
              />
            </div>

            {/* Employee Assignment */}
            <div className="space-y-3">
              <Label>
                <Users className="h-4 w-4 inline mr-1.5" />
                รายชื่อผู้ปฏิบัติงาน
              </Label>

              {/* Selected employees */}
              {formData.employeeList.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                  {formData.employeeList.map((emp) => (
                    <Badge
                      key={emp.userId}
                      variant="default"
                      className="pl-2 pr-1 py-1 gap-1"
                    >
                      <span className="text-xs">
                        {emp.firstName} {emp.lastName}
                        {emp.employeeId && (
                          <span className="text-[10px] opacity-70 ml-1">
                            ({emp.employeeId})
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((p) => ({
                            ...p,
                            employeeList: p.employeeList.filter(
                              (e) => e.userId !== emp.userId,
                            ),
                          }));
                        }}
                        className="ml-1 hover:bg-background/20 rounded-sm p-0.5"
                        aria-label="Remove employee"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Employee selector */}
              <div className="space-y-2">
                <Input
                  placeholder="ค้นหาชื่อ หรือรหัสพนักงาน..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="text-sm"
                />

                {isLoadingUsers ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    กำลังโหลดรายชื่อ...
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                    {availableUsers
                      .filter((user) => {
                        const selected = formData.employeeList.some(
                          (e) => e.userId === user.userId,
                        );
                        if (selected) return false;
                        if (!employeeSearch) return true;
                        const search = employeeSearch.toLowerCase();
                        return (
                          user.firstName.toLowerCase().includes(search) ||
                          user.lastName.toLowerCase().includes(search) ||
                          user.employeeId?.toLowerCase().includes(search)
                        );
                      })
                      .map((user) => (
                        <button
                          key={user.userId}
                          type="button"
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              employeeList: [...p.employeeList, user],
                            }));
                            setEmployeeSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0 flex items-center gap-2"
                        >
                          <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.employeeId && `${user.employeeId} • `}
                              {user.position || "ไม่ระบุตำแหน่ง"}
                              {user.departmentName &&
                                ` • ${user.departmentName}`}
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {!isLoadingUsers &&
                  availableUsers.filter(
                    (u) =>
                      !formData.employeeList.some((e) => e.userId === u.userId),
                  ).length === 0 && (
                    <p className="text-xs text-center text-muted-foreground py-4">
                      เลือกพนักงานครบทุกคนแล้ว
                    </p>
                  )}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={closeDialog}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            size="sm"
            onClick={dialogMode === "create" ? handleCreate : handleUpdate}
            disabled={isPending || !isFormValid}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {dialogMode === "create" ? "บันทึก" : "อัปเดต"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ================================================================= */}
      {/* VIEW DIALOG                                                        */}
      {/* ================================================================= */}
      <Dialog open={dialogMode === "view"} onClose={closeDialog}>
        <DialogClose onClose={closeDialog} />
        <DialogHeader>
          <DialogTitle>รายละเอียดคำสั่ง</DialogTitle>
          <DialogDescription>{selectedItem?.id}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {selectedItem && (
            <div className="space-y-4">
              <DetailRow
                label="เลขที่เอกสาร"
                value={selectedItem.id}
                icon={<FileText className="h-4 w-4" />}
              />
              {selectedItem.innerRefDocumentId && (
                <DetailRow
                  label="เลขอ้างอิงภายใน"
                  value={selectedItem.innerRefDocumentId}
                />
              )}
              <DetailRow
                label="วันที่"
                value={`${formatDate(selectedItem.startDate)} — ${formatDate(
                  selectedItem.endDate,
                )}`}
                icon={<Calendar className="h-4 w-4" />}
              />
              {selectedItem.location && (
                <DetailRow
                  label="สถานที่"
                  value={selectedItem.location}
                  icon={<MapPin className="h-4 w-4" />}
                />
              )}
              {selectedItem.objective && (
                <DetailRow
                  label="วัตถุประสงค์"
                  value={selectedItem.objective}
                  icon={<ClipboardList className="h-4 w-4" />}
                />
              )}

              {/* Employee List */}
              {selectedItem.employeeList &&
              Array.isArray(selectedItem.employeeList) &&
              (selectedItem.employeeList as EmployeeListItem[]).length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      รายชื่อผู้ปฏิบัติงาน (
                      {(selectedItem.employeeList as EmployeeListItem[]).length}{" "}
                      คน)
                    </span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    {(selectedItem.employeeList as EmployeeListItem[]).map(
                      (emp, idx) => (
                        <div
                          key={emp.userId}
                          className="text-sm py-1.5 px-2 rounded bg-muted/30 flex items-center gap-2"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium leading-tight">
                              {emp.firstName} {emp.lastName}
                            </p>
                            {(emp.employeeId || emp.position) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {emp.employeeId && `${emp.employeeId}`}
                                {emp.employeeId && emp.position && " • "}
                                {emp.position}
                              </p>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              <DetailRow
                label="ผู้บันทึก"
                value={`${selectedItem.postedByUser.firstName} ${selectedItem.postedByUser.lastName}`}
                icon={<User className="h-4 w-4" />}
              />
              {selectedItem.originalFile && (
                <DetailRow
                  label="ไฟล์แนบ"
                  value={selectedItem.originalFile.fileName}
                  icon={<FileText className="h-4 w-4" />}
                />
              )}
              <DetailRow
                label="วันที่บันทึก"
                value={formatDate(selectedItem.postedAt)}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={closeDialog}>
            ปิด
          </Button>
          {selectedItem && (
            <Button
              size="sm"
              onClick={() => {
                closeDialog();
                setTimeout(() => openEditDialog(selectedItem), 200);
              }}
            >
              <Pencil className="h-4 w-4 mr-1" />
              แก้ไข
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* ================================================================= */}
      {/* DELETE CONFIRMATION DIALOG                                         */}
      {/* ================================================================= */}
      <Dialog open={dialogMode === "delete"} onClose={closeDialog}>
        <DialogClose onClose={closeDialog} />
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>ยืนยันการลบ</DialogTitle>
              <DialogDescription>การลบจะไม่สามารถย้อนกลับได้</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm text-muted-foreground">
              คุณต้องการลบคำสั่งเลขที่{" "}
              <span className="font-semibold text-foreground">
                {selectedItem?.id}
              </span>{" "}
              ใช่หรือไม่?
            </p>
          </div>
          {selectedItem?.location && (
            <p className="text-sm text-muted-foreground">
              สถานที่: {selectedItem.location}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={closeDialog}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            ยืนยันลบ
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      {icon && (
        <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium wrap-break-word">{value}</p>
      </div>
    </div>
  );
}
