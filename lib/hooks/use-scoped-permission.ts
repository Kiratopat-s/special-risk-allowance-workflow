"use client";
import { usePermissions } from "./use-permissions";
import type { PermissionAction, PermissionResource } from "@/lib/shared/types";
/** Mirrors current server scope precedence for UI affordances; server checks stay authoritative. */
export function useScopedPermission(resource: PermissionResource) {
  const { permissions } = usePermissions();
  const userId = permissions?.userId;
  const allows = (action: PermissionAction, ownerId?: string) => {
    const matches =
      permissions?.permissions.filter(
        (p) => p.resource === resource && p.action === action,
      ) || [];
    if (!matches.length)
      return !!permissions?.permissions.some(
        (p) => p.resource === resource && p.action === "MANAGE",
      );
    return matches.some(
      (p) => p.scope !== "OWN" || !ownerId || ownerId === userId,
    );
  };
  return { allows, userId };
}
