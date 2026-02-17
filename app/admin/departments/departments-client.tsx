"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
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
  Building2,
  Users,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Network,
} from "lucide-react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  toggleDepartmentStatus,
  listAllDepartments,
} from "@/app/actions/department";
import type { DepartmentWithHierarchy } from "@/lib/domains/department";

// =============================================================================
// TYPES
// =============================================================================

interface DepartmentsClientProps {
  initialDepartments: DepartmentWithHierarchy[];
}

type DialogMode = "create" | "edit" | "delete" | null;

interface FormData {
  name: string;
  shortName: string;
  description: string;
  parentId: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DepartmentsClient({
  initialDepartments,
}: DepartmentsClientProps) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedDepartment, setSelectedDepartment] =
    useState<DepartmentWithHierarchy | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    shortName: "",
    description: "",
    parentId: "",
  });
  const [isPending, startTransition] = useTransition();

  // Filter departments
  const filtered = departments.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.shortName?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && d.isActive) ||
      (statusFilter === "inactive" && !d.isActive);

    return matchesSearch && matchesStatus;
  });

  const refreshDepartments = async () => {
    const result = await listAllDepartments({
      search: search || undefined,
      // Always fetch all departments to support all filter states
    });
    if (result.success) setDepartments(result.data);
  };

  const openCreateDialog = () => {
    setFormData({ name: "", shortName: "", description: "", parentId: "" });
    setSelectedDepartment(null);
    setDialogMode("create");
  };

  const openEditDialog = (department: DepartmentWithHierarchy) => {
    setFormData({
      name: department.name,
      shortName: department.shortName || "",
      description: department.description || "",
      parentId: department.parentId || "",
    });
    setSelectedDepartment(department);
    setDialogMode("edit");
  };

  const openDeleteDialog = (department: DepartmentWithHierarchy) => {
    setSelectedDepartment(department);
    setDialogMode("delete");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedDepartment(null);
    setFormData({ name: "", shortName: "", description: "", parentId: "" });
  };

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createDepartment({
        name: formData.name,
        shortName: formData.shortName || undefined,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
      });

      if (result.success) {
        toast.success("Department created", {
          description: `${formData.name} has been created successfully`,
        });
        await refreshDepartments();
        closeDialog();
      } else {
        toast.error("Failed to create department", {
          description: result.error,
        });
      }
    });
  };

  const handleUpdate = () => {
    if (!selectedDepartment) return;

    startTransition(async () => {
      const result = await updateDepartment(selectedDepartment.id, {
        name:
          formData.name !== selectedDepartment.name ? formData.name : undefined,
        shortName:
          formData.shortName !== (selectedDepartment.shortName || "")
            ? formData.shortName || undefined
            : undefined,
        description:
          formData.description !== (selectedDepartment.description || "")
            ? formData.description || undefined
            : undefined,
        parentId:
          formData.parentId !== (selectedDepartment.parentId || "")
            ? formData.parentId || undefined
            : undefined,
      });

      if (result.success) {
        toast.success("Department updated", {
          description: `${formData.name} has been updated successfully`,
        });
        await refreshDepartments();
        closeDialog();
      } else {
        toast.error("Failed to update department", {
          description: result.error,
        });
      }
    });
  };

  const handleDelete = () => {
    if (!selectedDepartment) return;

    startTransition(async () => {
      const result = await deleteDepartment(selectedDepartment.id);

      if (result.success) {
        toast.success("Department deleted", {
          description: `${selectedDepartment.name} has been deleted`,
        });
        await refreshDepartments();
        closeDialog();
      } else {
        toast.error("Failed to delete department", {
          description: result.error,
        });
      }
    });
  };

  const handleToggleStatus = (department: DepartmentWithHierarchy) => {
    startTransition(async () => {
      const result = await toggleDepartmentStatus(department.id);

      if (result.success) {
        const newStatus = !department.isActive;
        toast.success(`Department ${newStatus ? "activated" : "deactivated"}`, {
          description: `${department.name} is now ${
            newStatus ? "active" : "inactive"
          }`,
        });
        await refreshDepartments();
      } else {
        toast.error("Failed to update status", {
          description: result.error,
        });
      }
    });
  };

  // Status filter options
  const statusFilterOptions: SelectOption[] = [
    { value: "all", label: "All Departments" },
    { value: "active", label: "Active Only" },
    { value: "inactive", label: "Inactive Only" },
  ];

  // Parent department options (exclude current for edit)
  const parentDepartmentOptions: SelectOption[] = [
    { value: "", label: "None (Root Department)" },
    ...departments
      .filter(
        (d) =>
          d.isActive && (!selectedDepartment || d.id !== selectedDepartment.id),
      )
      .map((d) => ({
        value: d.id,
        label: d.name,
        description: d.shortName || undefined,
      })),
  ];

  const isFormValid = formData.name.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Manage organizational departments and hierarchy
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-64">
          <Select
            options={statusFilterOptions}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Filter by status..."
          />
        </div>
      </div>

      {/* Departments Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left font-medium p-3">Department</th>
              <th className="text-left font-medium p-3 hidden md:table-cell">
                Parent
              </th>
              <th className="text-left font-medium p-3 hidden lg:table-cell">
                Children
              </th>
              <th className="text-center font-medium p-3 hidden sm:table-cell">
                Users
              </th>
              <th className="text-center font-medium p-3">Status</th>
              <th className="text-right font-medium p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dept) => (
              <tr
                key={dept.id}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{dept.name}</div>
                      {dept.shortName && (
                        <div className="text-xs text-muted-foreground">
                          {dept.shortName}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">
                  {dept.parent ? (
                    <div className="flex items-center gap-1">
                      <Network className="h-3 w-3" />
                      <span>{dept.parent.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs">Root</span>
                  )}
                </td>
                <td className="p-3 hidden lg:table-cell">
                  {dept.children.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {dept.children.slice(0, 2).map((child) => (
                        <Badge
                          key={child.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {child.name}
                        </Badge>
                      ))}
                      {dept.children.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{dept.children.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </td>
                <td className="p-3 text-center hidden sm:table-cell">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span>{dept._count?.users || 0}</span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleToggleStatus(dept)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
                    title={`Click to ${
                      dept.isActive ? "deactivate" : "activate"
                    }`}
                  >
                    {dept.isActive ? (
                      <>
                        <ToggleRight className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Active</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Inactive</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(dept)}
                      title="Edit department"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(dept)}
                      title="Delete department"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  No departments found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
      >
        <DialogClose onClose={closeDialog} />
        <DialogHeader>
          <DialogTitle>
            {dialogMode === "create" ? "Create Department" : "Edit Department"}
          </DialogTitle>
          <DialogDescription>
            {dialogMode === "create"
              ? "Add a new department to your organization"
              : "Update department information"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Department Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Human Resources"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                autoFocus
              />
            </div>

            {/* Short Name */}
            <div className="space-y-2">
              <Label htmlFor="shortName">Short Name</Label>
              <Input
                id="shortName"
                placeholder="e.g., HR"
                value={formData.shortName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    shortName: e.target.value,
                  }))
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the department..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {/* Parent Department */}
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Department</Label>
              <Select
                options={parentDepartmentOptions}
                value={formData.parentId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, parentId: value }))
                }
                placeholder="Select parent department..."
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to create a root-level department
              </p>
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
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={dialogMode === "create" ? handleCreate : handleUpdate}
            disabled={isPending || !isFormValid}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {dialogMode === "create" ? "Create" : "Update"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={dialogMode === "delete"} onClose={closeDialog}>
        <DialogClose onClose={closeDialog} />
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete Department</DialogTitle>
              <DialogDescription>
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive mb-2">
              ⚠️ Warning
            </p>
            <p className="text-sm text-muted-foreground">
              You are about to delete{" "}
              <span className="font-semibold text-foreground">
                {selectedDepartment?.name}
              </span>
              .
            </p>
          </div>

          {selectedDepartment && (
            <>
              {selectedDepartment._count &&
                selectedDepartment._count.users > 0 && (
                  <p className="text-sm text-destructive">
                    This department has {selectedDepartment._count.users}{" "}
                    assigned user(s). You must reassign them before deleting.
                  </p>
                )}

              {selectedDepartment.children.length > 0 && (
                <p className="text-sm text-destructive">
                  This department has {selectedDepartment.children.length} child
                  department(s). You must remove or reassign them first.
                </p>
              )}
            </>
          )}

          <p className="text-sm font-medium">
            Are you sure you want to continue?
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={closeDialog}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Yes, Delete Department
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
