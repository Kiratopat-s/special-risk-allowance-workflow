"use client";

/**
 * Permission Hooks
 * 
 * React hooks for checking permissions in client components
 * 
 * @module lib/hooks/use-permissions
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PermissionResource, PermissionAction } from "@/lib/shared/types";
import type { UserEffectivePermissions } from "@/lib/domains/permission";

// =============================================================================
// TYPES
// =============================================================================

interface PermissionCheck {
    resource: PermissionResource;
    action: PermissionAction;
}

interface UsePermissionsResult {
    permissions: UserEffectivePermissions | null;
    isLoading: boolean;
    error: Error | null;
    can: (resource: PermissionResource, action: PermissionAction) => boolean;
    canAny: (checks: PermissionCheck[]) => boolean;
    canAll: (checks: PermissionCheck[]) => boolean;
    hasRole: (roleCode: string) => boolean;
    refresh: () => Promise<void>;
}

interface UsePermissionCheckResult {
    allowed: boolean;
    isLoading: boolean;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to get and check user permissions
 */
export function usePermissions(): UsePermissionsResult {
    const [permissions, setPermissions] = useState<UserEffectivePermissions | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchPermissions = useCallback(async () => {
        try {
            setIsLoading(true);
            const { getMyPermissions } = await import("@/app/actions/permissions");
            const result = await getMyPermissions();

            if (result.success) {
                setPermissions(result.data);
                setError(null);
            } else {
                setError(new Error(result.error));
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to fetch permissions"));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const can = useCallback(
        (resource: PermissionResource, action: PermissionAction): boolean => {
            if (!permissions) return false;

            return permissions.permissions.some(
                (p) =>
                    (p.resource === resource && p.action === action) ||
                    (p.resource === resource && p.action === "MANAGE")
            );
        },
        [permissions]
    );

    const canAny = useCallback(
        (checks: PermissionCheck[]): boolean => {
            return checks.some((check) => can(check.resource, check.action));
        },
        [can]
    );

    const canAll = useCallback(
        (checks: PermissionCheck[]): boolean => {
            return checks.every((check) => can(check.resource, check.action));
        },
        [can]
    );

    const hasRole = useCallback(
        (roleCode: string): boolean => {
            if (!permissions) return false;
            return permissions.roles.some((r) => r.code === roleCode);
        },
        [permissions]
    );

    return {
        permissions,
        isLoading,
        error,
        can,
        canAny,
        canAll,
        hasRole,
        refresh: fetchPermissions,
    };
}

/**
 * Hook to check a single permission
 */
export function usePermissionCheck(
    resource: PermissionResource,
    action: PermissionAction
): UsePermissionCheckResult {
    const { can, isLoading } = usePermissions();

    const allowed = useMemo(
        () => can(resource, action),
        [can, resource, action]
    );

    return { allowed, isLoading };
}

/**
 * Hook to check if user has a specific role
 */
export function useRoleCheck(roleCode: string): UsePermissionCheckResult {
    const { hasRole, isLoading } = usePermissions();

    const allowed = useMemo(
        () => hasRole(roleCode),
        [hasRole, roleCode]
    );

    return { allowed, isLoading };
}

// =============================================================================
// PERMISSION-GATED COMPONENT HELPERS
// =============================================================================

interface PermissionGateProps {
    children: React.ReactNode;
    resource: PermissionResource;
    action: PermissionAction;
    fallback?: React.ReactNode;
}

/**
 * Component that only renders children if user has permission
 */
export function PermissionGate({
    children,
    resource,
    action,
    fallback = null,
}: PermissionGateProps): React.ReactNode {
    const { allowed, isLoading } = usePermissionCheck(resource, action);

    if (isLoading) return null;
    if (!allowed) return fallback;

    return children;
}

interface RoleGateProps {
    children: React.ReactNode;
    role: string;
    fallback?: React.ReactNode;
}

/**
 * Component that only renders children if user has role
 */
export function RoleGate({
    children,
    role,
    fallback = null,
}: RoleGateProps): React.ReactNode {
    const { allowed, isLoading } = useRoleCheck(role);

    if (isLoading) return null;
    if (!allowed) return fallback;

    return children;
}

interface PermissionAnyGateProps {
    children: React.ReactNode;
    permissions: PermissionCheck[];
    fallback?: React.ReactNode;
}

/**
 * Component that renders children if user has any of the permissions
 */
export function PermissionAnyGate({
    children,
    permissions: checks,
    fallback = null,
}: PermissionAnyGateProps): React.ReactNode {
    const { canAny, isLoading } = usePermissions();

    if (isLoading) return null;
    if (!canAny(checks)) return fallback;

    return children;
}
