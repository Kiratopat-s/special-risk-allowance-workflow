"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import {
  Plus,
  Search,
  Shield,
  ChevronRight,
  Loader2,
  Lock,
} from "lucide-react";
import {
  createRole,
  updateRole,
  getRole,
  setRolePermissions as setRolePermissionsAction,
} from "@/app/actions/permissions";
import type { RoleEntity, PermissionEntity } from "@/lib/domains/permission";

// =============================================================================
// TYPES
// =============================================================================

interface RolesClientProps {
  initialRoles: RoleEntity[];
  allPermissions: PermissionEntity[];
}

// =============================================================================
// HELPERS
// =============================================================================

function roleLevelBadge(level: number) {
  if (level >= 90) return "destructive" as const;
  if (level >= 50) return "warning" as const;
  if (level >= 10) return "default" as const;
  return "secondary" as const;
}

function groupPermissionsByResource(
  permissions: PermissionEntity[],
): Record<string, PermissionEntity[]> {
  return permissions.reduce((groups, perm) => {
    const key = perm.resource;
    if (!groups[key]) groups[key] = [];
    groups[key].push(perm);
    return groups;
  }, {} as Record<string, PermissionEntity[]>);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function RolesClient({
  initialRoles,
  allPermissions,
}: RolesClientProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleEntity | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()),
  );

  // Load role detail with its permissions
  const handleSelectRole = (role: RoleEntity) => {
    setSelectedRole(role);
    setShowDetailPanel(true);
    startTransition(async () => {
      const result = await getRole(role.id);
      if (result.success) {
        setRolePermissions(result.data.permissions.map((p) => p.id));
      } else {
        toast.error("Failed to load role", {
          description: result.error,
        });
      }
    });
  };

  const handleTogglePermission = (permId: string) => {
    setRolePermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((id) => id !== permId)
        : [...prev, permId],
    );
  };

  const handleSavePermissions = () => {
    if (!selectedRole) return;
    startTransition(async () => {
      const result = await setRolePermissionsAction(
        selectedRole.id,
        rolePermissions,
      );
      if (result.success) {
        toast.success("Permissions updated", {
          description: `Updated permissions for ${selectedRole.name}`,
        });
        // Refresh the role to get the updated data
        const updated = await getRole(selectedRole.id);
        if (updated.success) {
          setRolePermissions(updated.data.permissions.map((p) => p.id));
        }
      } else {
        toast.error("Failed to update permissions", {
          description: result.error,
        });
      }
    });
  };

  const handleCreateRole = (formData: FormData) => {
    const code = formData.get("code") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const level = parseInt(formData.get("level") as string) || 0;

    startTransition(async () => {
      const result = await createRole({ code, name, description, level });
      if (result.success) {
        setRoles((prev) => [...prev, result.data]);
        setShowCreateDialog(false);
        toast.success("Role created", {
          description: `Created role: ${name}`,
        });
      } else {
        toast.error("Failed to create role", {
          description: result.error,
        });
      }
    });
  };

  const grouped = groupPermissionsByResource(allPermissions);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Role
        </Button>
      </div>

      {/* Layout: Role List + Detail Panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        {/* Role List */}
        <div className="space-y-2">
          {filteredRoles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role)}
              className={`w-full text-left rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                selectedRole?.id === role.id
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{role.name}</span>
                      {role.isSystem && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {role.code}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={roleLevelBadge(role.level)}>
                    Lv.{role.level}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {role.description && (
                <p className="mt-2 text-xs text-muted-foreground pl-12">
                  {role.description}
                </p>
              )}
            </button>
          ))}

          {filteredRoles.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No roles found
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {showDetailPanel && selectedRole ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {selectedRole.name}
                  </CardTitle>
                  <CardDescription>
                    Manage permissions for this role
                  </CardDescription>
                </div>
                <Badge variant={roleLevelBadge(selectedRole.level)}>
                  Level {selectedRole.level}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Permission groups */}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {Object.entries(grouped).map(([resource, perms]) => (
                      <div key={resource}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {resource.replace(/_/g, " ")}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={rolePermissions.includes(perm.id)}
                                onChange={() => handleTogglePermission(perm.id)}
                                className="h-3.5 w-3.5 rounded border-input accent-primary"
                              />
                              <span className="truncate">{perm.name}</span>
                              <Badge
                                variant="outline"
                                className="ml-auto shrink-0 text-[10px]"
                              >
                                {perm.scope}
                              </Badge>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save */}
                  <div className="flex justify-end border-t pt-4">
                    <Button
                      size="sm"
                      onClick={handleSavePermissions}
                      disabled={isPending}
                    >
                      {isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Save Permissions
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="hidden lg:flex items-center justify-center rounded-lg border border-dashed border-border py-24">
            <div className="text-center text-sm text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Select a role to manage its permissions</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Role Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      >
        <DialogClose onClose={() => setShowCreateDialog(false)} />
        <DialogHeader>
          <DialogTitle>Create Role</DialogTitle>
          <DialogDescription>Add a new role to the system</DialogDescription>
        </DialogHeader>
        <form action={handleCreateRole}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Code</label>
              <Input
                name="code"
                placeholder="e.g. team-lead"
                required
                pattern="^[a-z0-9-]+$"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input name="name" placeholder="e.g. Team Lead" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                name="description"
                placeholder="Brief description of this role"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Level</label>
              <Input
                name="level"
                type="number"
                min={0}
                max={100}
                defaultValue={10}
                placeholder="0-100"
              />
              <p className="text-xs text-muted-foreground">
                Higher level = more authority (0–100)
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
