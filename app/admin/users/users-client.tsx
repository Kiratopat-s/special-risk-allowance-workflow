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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  UserPlus,
  X,
  Loader2,
  User,
  AlertTriangle,
  Globe,
  Building2,
  Filter,
} from "lucide-react";
import {
  assignRoleToUser,
  revokeRoleFromUser,
  listUsersWithRoles,
} from "@/app/actions/permissions";
import type { RoleEntity } from "@/lib/domains/permission";
import type { DepartmentEntity } from "@/lib/domains/department";

// =============================================================================
// TYPES
// =============================================================================

interface UserRole {
  id: string;
  code: string;
  name: string;
  userRoleId: string;
  departmentId: string | null;
  departmentName: string | null;
}

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roles: UserRole[];
}

interface UsersClientProps {
  initialUsers: UserRow[];
  allRoles: RoleEntity[];
  allDepartments: DepartmentEntity[];
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function UsersClient({
  initialUsers,
  allRoles,
  allDepartments,
}: UsersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingRevocation, setPendingRevocation] = useState<{
    userId: string;
    roleId: string;
    departmentId: string | null;
    userName: string;
    roleName: string;
    departmentName: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter users by search and department
  const filtered = users.filter((u) => {
    const matchesSearch =
      u.firstName.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesDepartment =
      !departmentFilter || u.departmentId === departmentFilter;

    return matchesSearch && matchesDepartment;
  });

  const refreshUsers = async () => {
    const result = await listUsersWithRoles(search || undefined);
    if (result.success) setUsers(result.data);
  };

  const handleAssignRole = () => {
    if (!selectedUser || !selectedRoleId) return;
    const roleName = allRoles.find((r) => r.id === selectedRoleId)?.name;
    const deptName =
      allDepartments.find((d) => d.id === selectedDepartmentId)?.name || null;

    startTransition(async () => {
      const result = await assignRoleToUser(selectedUser.id, selectedRoleId, {
        departmentId: selectedDepartmentId || undefined,
      });
      if (result.success) {
        const contextMsg = selectedDepartmentId
          ? ` (${deptName})`
          : " (Global)";
        toast.success("Role assigned", {
          description: `Assigned ${roleName}${contextMsg} to ${selectedUser.firstName} ${selectedUser.lastName}`,
        });
        await refreshUsers();
        setShowRoleDialog(false);
        setSelectedRoleId("");
        setSelectedDepartmentId("");
      } else {
        toast.error("Failed to assign role", {
          description: result.error,
        });
      }
    });
  };

  const handleRevokeRole = (
    userId: string,
    roleId: string,
    departmentId: string | null
  ) => {
    const user = users.find((u) => u.id === userId);
    const role = user?.roles.find(
      (r) => r.id === roleId && r.departmentId === departmentId
    );

    if (!user || !role) return;

    // Check if it's a critical role that needs confirmation
    const isCriticalRole = role.code === "super-admin" || role.code === "admin";

    if (isCriticalRole) {
      // Show confirmation dialog for critical roles
      setPendingRevocation({
        userId,
        roleId,
        departmentId,
        userName: `${user.firstName} ${user.lastName}`,
        roleName: role.name,
        departmentName: role.departmentName,
      });
      setShowConfirmDialog(true);
    } else {
      // Directly revoke non-critical roles
      confirmRevocation(userId, roleId, departmentId, user, role);
    }
  };

  const confirmRevocation = (
    userId: string,
    roleId: string,
    departmentId: string | null,
    user?: UserRow,
    role?: UserRole
  ) => {
    const targetUser = user || users.find((u) => u.id === userId);
    const targetRole =
      role ||
      targetUser?.roles.find(
        (r) => r.id === roleId && r.departmentId === departmentId
      );

    startTransition(async () => {
      const result = await revokeRoleFromUser(userId, roleId, departmentId);
      if (result.success) {
        const contextMsg = targetRole?.departmentName
          ? ` (${targetRole.departmentName})`
          : " (Global)";
        toast.success("Role revoked", {
          description: `Removed ${targetRole?.name}${contextMsg} from ${targetUser?.firstName} ${targetUser?.lastName}`,
        });
        await refreshUsers();
        setShowConfirmDialog(false);
        setPendingRevocation(null);
      } else {
        toast.error("Failed to revoke role", {
          description: result.error,
        });
      }
    });
  };

  const handleConfirmRevocation = () => {
    if (!pendingRevocation) return;
    confirmRevocation(
      pendingRevocation.userId,
      pendingRevocation.roleId,
      pendingRevocation.departmentId
    );
  };

  const openRoleDialog = (user: UserRow) => {
    setSelectedUser(user);
    setSelectedRoleId("");
    setSelectedDepartmentId("");
    setShowRoleDialog(true);
  };

  // Department options for filtering
  const departmentFilterOptions: SelectOption[] = [
    { value: "", label: "All Departments" },
    ...allDepartments.map((d) => ({
      value: d.id,
      label: d.name,
      description: d.shortName || undefined,
    })),
  ];

  // Department options for role assignment
  const departmentAssignOptions: SelectOption[] = [
    { value: "", label: "Global (All Departments)", description: "Role applies everywhere" },
    ...allDepartments.map((d) => ({
      value: d.id,
      label: d.name,
      description: d.shortName || undefined,
    })),
  ];

  // Available roles for assignment
  const availableRoleOptions: SelectOption[] = allRoles
    .filter((r) => r.isActive)
    .map((r) => ({
      value: r.id,
      label: r.name,
      description: r.description || undefined,
    }));

  return (
    <div className="space-y-4">{/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-64">
          <Select
            options={departmentFilterOptions}
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
            placeholder="Filter by department..."
          />
        </div>
      </div>

      {/* User Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left font-medium p-3">User</th>
              <th className="text-left font-medium p-3 hidden md:table-cell">
                Department
              </th>
              <th className="text-left font-medium p-3">Roles</th>
              <th className="text-right font-medium p-3 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr
                key={user.id}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">
                  {user.departmentName ?? "—"}
                </td>
                <td className="p-3">
                  <ScrollArea className="max-h-24">
                    <div className="flex flex-wrap gap-1 pr-2">
                      {user.roles.map((role) => {
                        const roleData = allRoles.find((r) => r.id === role.id);
                        const isCriticalRole =
                          role.code === "super-admin" || role.code === "admin";
                        const isGlobal = !role.departmentId;

                        return (
                          <Badge
                            key={role.userRoleId}
                            variant={
                              isCriticalRole ? "destructive" : "secondary"
                            }
                            className="group gap-1 pr-1"
                          >
                            {isGlobal ? (
                              <Globe className="h-3 w-3" />
                            ) : (
                              <Building2 className="h-3 w-3" />
                            )}
                            <span className="flex items-center gap-1">
                              {role.name}
                              {!isGlobal && role.departmentName && (
                                <span className="text-xs opacity-70">
                                  ({role.departmentName})
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleRevokeRole(
                                  user.id,
                                  role.id,
                                  role.departmentId
                                )
                              }
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:bg-background/20 rounded p-0.5"
                              disabled={isPending}
                              title={
                                isCriticalRole
                                  ? "Warning: Critical system role"
                                  : "Remove role"
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                      {user.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          No roles
                        </span>
                      )}
                    </div>
                  </ScrollArea>
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openRoleDialog(user)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-12 text-muted-foreground"
                >
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={showRoleDialog} onClose={() => setShowRoleDialog(false)}>
        <DialogClose onClose={() => setShowRoleDialog(false)} />
        <DialogHeader>
          <DialogTitle>Assign Role</DialogTitle>
          <DialogDescription>
            Add a role to{" "}
            {selectedUser
              ? `${selectedUser.firstName} ${selectedUser.lastName}`
              : "user"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                options={availableRoleOptions}
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                placeholder="Select a role..."
                emptyText="No roles available"
              />
            </div>

            {/* Department Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Scope</label>
              <Select
                options={departmentAssignOptions}
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
                placeholder="Select scope..."
              />
              <p className="text-xs text-muted-foreground">
                {selectedDepartmentId
                  ? "Role will only apply within the selected department"
                  : "Role will apply globally across all departments"}
              </p>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRoleDialog(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleAssignRole}
            disabled={isPending || !selectedRoleId}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Assign Role
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirmation Dialog for Critical Role Revocation */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setPendingRevocation(null);
        }}
      >
        <DialogClose
          onClose={() => {
            setShowConfirmDialog(false);
            setPendingRevocation(null);
          }}
        />
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Confirm Role Revocation</DialogTitle>
              <DialogDescription>
                This action requires confirmation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive mb-2">
              ⚠️ Warning: Critical System Role
            </p>
            <p className="text-sm text-muted-foreground">
              You are about to remove the{" "}
              <span className="font-semibold text-foreground">
                {pendingRevocation?.roleName}
                {pendingRevocation?.departmentName &&
                  ` (${pendingRevocation.departmentName})`}
              </span>{" "}
              role from{" "}
              <span className="font-semibold text-foreground">
                {pendingRevocation?.userName}
              </span>
              .
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            This is a critical system role with administrative privileges.
            Removing this role may affect the user&apos;s ability to manage the
            system.
          </p>
          <p className="text-sm font-medium">
            Are you sure you want to continue?
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowConfirmDialog(false);
              setPendingRevocation(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirmRevocation}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Yes, Remove Role
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
