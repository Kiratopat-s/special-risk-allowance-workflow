/**
 * Permission Utilities
 * 
 * Helper functions and utilities for permission checking across the application
 * 
 * @module lib/auth/permissions
 */

import { authorizationService } from "@/lib/domains/permission";
import type { PermissionResource, PermissionAction } from "@/lib/shared/types";

// =============================================================================
// PERMISSION CODE HELPERS
// =============================================================================

/**
 * Generate a permission code from resource and action
 */
export function permissionCode(resource: PermissionResource, action: PermissionAction): string {
    return `${resource.toLowerCase()}:${action.toLowerCase()}`;
}

/**
 * Parse a permission code into resource and action
 */
export function parsePermissionCode(code: string): {
    resource: string;
    action: string;
} {
    const [resource, action] = code.split(":");
    return { resource: resource.toUpperCase(), action: action.toUpperCase() };
}

// =============================================================================
// PERMISSION CHECK HELPERS
// =============================================================================

/**
 * Check if user has a specific permission
 */
export async function can(
    userId: string,
    resource: PermissionResource,
    action: PermissionAction,
    options?: {
        departmentId?: string;
        targetOwnerId?: string;
    }
): Promise<boolean> {
    const result = await authorizationService.checkPermission({
        userId,
        resource,
        action,
        targetDepartmentId: options?.departmentId,
        targetOwnerId: options?.targetOwnerId,
    });
    return result.allowed;
}

/**
 * Check if user has any of the specified permissions
 */
export async function canAny(
    userId: string,
    permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
): Promise<boolean> {
    const results = await authorizationService.checkPermissions(userId, permissions);
    return Array.from(results.values()).some((allowed) => allowed);
}

/**
 * Check if user has all of the specified permissions
 */
export async function canAll(
    userId: string,
    permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
): Promise<boolean> {
    const results = await authorizationService.checkPermissions(userId, permissions);
    return Array.from(results.values()).every((allowed) => allowed);
}

/**
 * Check if user has a specific role
 */
export async function hasRole(
    userId: string,
    roleCode: string,
    departmentId?: string
): Promise<boolean> {
    return authorizationService.hasRole(userId, roleCode, departmentId);
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(
    userId: string,
    roleCodes: string[],
    departmentId?: string
): Promise<boolean> {
    const checks = await Promise.all(
        roleCodes.map((code) => authorizationService.hasRole(userId, code, departmentId))
    );
    return checks.some(Boolean);
}

// =============================================================================
// PERMISSION GUARD
// =============================================================================

export type PermissionGuardResult =
    | { authorized: true }
    | { authorized: false; error: string; code: string };

/**
 * Higher-order function to create permission guards for server actions
 */
export function createPermissionGuard(
    resource: PermissionResource,
    action: PermissionAction,
    options?: {
        departmentId?: string;
        getTargetOwnerId?: () => string | Promise<string>;
    }
) {
    return async (userId: string): Promise<PermissionGuardResult> => {
        const targetOwnerId = options?.getTargetOwnerId
            ? await options.getTargetOwnerId()
            : undefined;

        const result = await authorizationService.checkPermission({
            userId,
            resource,
            action,
            targetDepartmentId: options?.departmentId,
            targetOwnerId,
        });

        if (!result.allowed) {
            return {
                authorized: false,
                error: result.reason || "Permission denied",
                code: "PERMISSION_DENIED",
            };
        }

        return { authorized: true };
    };
}

/**
 * Create a guard that checks for any of the specified permissions
 */
export function createAnyPermissionGuard(
    permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
) {
    return async (userId: string): Promise<PermissionGuardResult> => {
        const hasAny = await canAny(userId, permissions);

        if (!hasAny) {
            return {
                authorized: false,
                error: "Permission denied",
                code: "PERMISSION_DENIED",
            };
        }

        return { authorized: true };
    };
}

/**
 * Create a guard that checks for all of the specified permissions
 */
export function createAllPermissionGuard(
    permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
) {
    return async (userId: string): Promise<PermissionGuardResult> => {
        const hasAll = await canAll(userId, permissions);

        if (!hasAll) {
            return {
                authorized: false,
                error: "Missing required permissions",
                code: "PERMISSION_DENIED",
            };
        }

        return { authorized: true };
    };
}

// =============================================================================
// ACTION WRAPPER
// =============================================================================

type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: string };

/**
 * Wrap a server action with permission checking
 */
export function withPermission<TArgs extends unknown[], TResult>(
    resource: PermissionResource,
    action: PermissionAction,
    getUserId: (...args: TArgs) => string | Promise<string>,
    handler: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<ActionResult<TResult>> {
    return async (...args: TArgs): Promise<ActionResult<TResult>> => {
        const userId = await getUserId(...args);
        const allowed = await can(userId, resource, action);

        if (!allowed) {
            return {
                success: false,
                error: "Permission denied",
                code: "PERMISSION_DENIED",
            };
        }

        try {
            const result = await handler(...args);
            return { success: true, data: result };
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            return { success: false, error: message };
        }
    };
}

/**
 * Wrap a server action with ownership-based permission checking
 */
export function withOwnershipPermission<TArgs extends unknown[], TResult>(
    resource: PermissionResource,
    action: PermissionAction,
    getUserId: (...args: TArgs) => string | Promise<string>,
    getOwnerId: (...args: TArgs) => string | Promise<string>,
    handler: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<ActionResult<TResult>> {
    return async (...args: TArgs): Promise<ActionResult<TResult>> => {
        const [userId, ownerId] = await Promise.all([
            getUserId(...args),
            getOwnerId(...args),
        ]);

        const allowed = await can(userId, resource, action, { targetOwnerId: ownerId });

        if (!allowed) {
            return {
                success: false,
                error: "Permission denied",
                code: "PERMISSION_DENIED",
            };
        }

        try {
            const result = await handler(...args);
            return { success: true, data: result };
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            return { success: false, error: message };
        }
    };
}
