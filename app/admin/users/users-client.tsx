"use client";

import { runServerAction } from "@/lib/deployment/client";
import { useWorkflowTransition as useTransition } from "@/lib/hooks/use-workflow-transition";
import { useUrlFilter } from "@/lib/hooks/use-url-filter";
import { Table, TableContainer, TableHead, TableBody, TableRow, TableHeader, TableCell } from "@/components/workflow-ui/table";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/workflow-ui/button";
import { LoadingButton } from "@/components/workflow-ui/loading-button";
import { Input } from "@/components/workflow-ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/workflow-ui/select";
import type { SelectOption } from "@/components/workflow-ui/select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/workflow-ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  UserPlus,
  X,
  User,
  AlertTriangle,
  Globe,
  Building2,
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
  const [search, setSearch] = useUrlFilter("search");
  const [departmentFilter, setDepartmentFilter] = useUrlFilter("department");
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
    const result = await runServerAction(() => listUsersWithRoles(search || undefined));
    if (result === undefined) return;
    if (result.success) setUsers(result.data);
  };

  const handleAssignRole = () => {
    if (!selectedUser || !selectedRoleId) return;
    const roleName = allRoles.find((r) => r.id === selectedRoleId)?.name;
    const deptName =
      allDepartments.find((d) => d.id === selectedDepartmentId)?.name || null;

    startTransition(async () => {
      const result = await runServerAction(() => assignRoleToUser(selectedUser.id, selectedRoleId, {
        departmentId: selectedDepartmentId || undefined,
      }));
      if (result === undefined) return;
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
    departmentId: string | null,
  ) => {
    const user = users.find((u) => u.id === userId);
    const role = user?.roles.find(
      (r) => r.id === roleId && r.departmentId === departmentId,
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
    role?: UserRole,
  ) => {
    const targetUser = user || users.find((u) => u.id === userId);
    const targetRole =
      role ||
      targetUser?.roles.find(
        (r) => r.id === roleId && r.departmentId === departmentId,
      );

    startTransition(async () => {
      const result = await runServerAction(() => revokeRoleFromUser(userId, roleId, departmentId));
      if (result === undefined) return;
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
      pendingRevocation.departmentId,
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
    {
      value: "",
      label: "Global (All Departments)",
      description: "Role applies everywhere",
    },
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="w-full min-w-0 sm:flex-1 sm:max-w-sm">
          <Input
            startAdornment={<Search className="h-4 w-4 text-muted-foreground" />}
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
      <TableContainer
        role="region"
        aria-busy={isPending || undefined}
        aria-label="Users"
        tabIndex={0}
        className="rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Table className="w-full min-w-[36rem] text-sm">
          <TableHead>
            <TableRow className="border-b bg-muted/50">
              <TableHeader className="min-w-56 text-left font-medium p-3">User</TableHeader>
              <TableHeader className="text-left font-medium p-3 hidden md:table-cell">
                Department
              </TableHeader>
              <TableHeader className="text-left font-medium p-3">Roles</TableHeader>
              <TableHeader className="text-right font-medium p-3 w-20">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((user) => (
              <TableRow
                key={user.id}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <TableCell className="min-w-56 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 break-words">
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="p-3 text-muted-foreground hidden md:table-cell">
                  {user.departmentName ?? "—"}
                </TableCell>
                <TableCell className="p-3">
                  <ScrollArea className="max-h-24 [&_[data-slot=scroll-area-viewport]]:max-h-24">
                    <div className="flex flex-wrap gap-1 pr-2">
                      {user.roles.map((role) => {
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
                            <span className="flex min-w-0 flex-wrap items-center gap-1 break-words">
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
                                  role.departmentId,
                                )
                              }
                              className="shrink-0 opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-current transition-opacity ml-1 hover:bg-background/20 rounded p-0.5"
                              aria-label={`Remove ${role.name} from ${user.firstName} ${user.lastName}`}
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
                </TableCell>
                <TableCell className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Assign role to ${user.firstName} ${user.lastName}`}
                    onClick={() => openRoleDialog(user)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-12 text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
          <LoadingButton
            size="sm"
            onClick={handleAssignRole}
            disabled={isPending || !selectedRoleId}
            isLoading={isPending}
            loadingText="Assigning"
          >
            Assign Role
          </LoadingButton>
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
          <LoadingButton
            variant="destructive"
            size="sm"
            onClick={handleConfirmRevocation}
            isLoading={isPending}
            loadingText="Removing"
          >
            Yes, Remove Role
          </LoadingButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
