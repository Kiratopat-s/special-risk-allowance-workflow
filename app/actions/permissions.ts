"use server";

/**
 * Permission Server Actions
 * 
 * Server actions for managing permissions and roles
 * 
 * @module app/actions/permissions
 */

import { auth } from "@/lib/auth";
import {
    permissionService,
    roleService,
    authorizationService,
} from "@/lib/domains/permission";
import { userRoleRepository } from "@/lib/domains/permission/repository";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import type { PermissionResource, PermissionAction, PermissionScope } from "@/lib/shared/types";
import type { Result } from "@/lib/shared/types";
import type {
    PermissionEntity,
    RoleEntity,
    RoleWithPermissions,
    UserRoleWithDetails,
    UserEffectivePermissions,
} from "@/lib/domains/permission";

// =============================================================================
// PERMISSION ACTIONS
// =============================================================================

/**
 * List all permissions
 */
export async function listPermissions(filters?: {
    resource?: PermissionResource;
    action?: PermissionAction;
    scope?: PermissionScope;
    isActive?: boolean;
    search?: string;
}): Promise<Result<PermissionEntity[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canList = await can(session.user.dbUserId, "PERMISSION", "LIST");
    if (!canList) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return permissionService.list(filters);
}

/**
 * Get permission by ID
 */
export async function getPermission(id: string): Promise<Result<PermissionEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canRead = await can(session.user.dbUserId, "PERMISSION", "READ");
    if (!canRead) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return permissionService.getById(id);
}

// =============================================================================
// ROLE ACTIONS
// =============================================================================

/**
 * List all roles
 */
export async function listRoles(filters?: {
    isActive?: boolean;
    isSystem?: boolean;
    search?: string;
}): Promise<Result<RoleEntity[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canList = await can(session.user.dbUserId, "ROLE", "LIST");
    if (!canList) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return roleService.list(filters);
}

/**
 * Get role by ID with permissions
 */
export async function getRole(id: string): Promise<Result<RoleWithPermissions>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canRead = await can(session.user.dbUserId, "ROLE", "READ");
    if (!canRead) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return roleService.getWithPermissions(id);
}

/**
 * Create a new role
 */
export async function createRole(data: {
    code: string;
    name: string;
    description?: string;
    level?: number;
}): Promise<Result<RoleEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canCreate = await can(session.user.dbUserId, "ROLE", "CREATE");
    if (!canCreate) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return roleService.create(data);
}

/**
 * Update a role
 */
export async function updateRole(
    id: string,
    data: {
        name?: string;
        description?: string;
        level?: number;
        isActive?: boolean;
    }
): Promise<Result<RoleEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canUpdate = await can(session.user.dbUserId, "ROLE", "UPDATE");
    if (!canUpdate) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return roleService.update(id, data);
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<Result<void>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canDelete = await can(session.user.dbUserId, "ROLE", "DELETE");
    if (!canDelete) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return roleService.delete(id);
}

/**
 * Set permissions for a role
 */
export async function setRolePermissions(
    roleId: string,
    permissionIds: string[]
): Promise<Result<void>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canManage = await can(session.user.dbUserId, "ROLE", "MANAGE");
    if (!canManage) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return roleService.setPermissions(roleId, permissionIds, session.user.dbUserId);
}

// =============================================================================
// USER ROLE ACTIONS
// =============================================================================

/**
 * Assign role to user
 */
export async function assignRoleToUser(
    userId: string,
    roleId: string,
    options?: {
        departmentId?: string;
        expiresAt?: Date;
    }
): Promise<Result<void>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canManage = await can(session.user.dbUserId, "USER", "MANAGE");
    if (!canManage) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return authorizationService.assignRole({
        userId,
        roleId,
        departmentId: options?.departmentId,
        assignedById: session.user.dbUserId,
        expiresAt: options?.expiresAt,
    });
}

/**
 * Revoke role from user
 */
export async function revokeRoleFromUser(
    userId: string,
    roleId: string,
    departmentId?: string | null
): Promise<Result<void>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canManage = await can(session.user.dbUserId, "USER", "MANAGE");
    if (!canManage) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    // Check if revoking a critical role (super-admin)
    const role = await roleService.getById(roleId);
    if (role.success && role.data.code === "super-admin") {
        // Count remaining super-admins
        const superAdminRole = await roleService.getByCode("super-admin");
        if (superAdminRole.success) {
            const superAdmins = await userRoleRepository.getUsersByRole(superAdminRole.data.id);
            const activeSuperAdmins = superAdmins.filter((ur) => ur.isActive && ur.userId !== userId);

            if (activeSuperAdmins.length === 0) {
                return {
                    success: false,
                    error: "Cannot remove the last super-admin from the system",
                    code: "VALIDATION_ERROR",
                };
            }
        }
    }

    return authorizationService.revokeRole(userId, roleId, departmentId ?? undefined);
}

/**
 * Get roles for a user
 */
export async function getUserRoles(userId: string): Promise<Result<UserRoleWithDetails[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    // Users can view their own roles, admins can view anyone's
    if (session.user.dbUserId !== userId) {
        const canRead = await can(session.user.dbUserId, "USER", "READ");
        if (!canRead) {
            return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
        }
    }

    return authorizationService.getUserRoles(userId);
}

/**
 * Get current user's effective permissions
 */
export async function getMyPermissions(): Promise<Result<UserEffectivePermissions>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    return authorizationService.getEffectivePermissions(session.user.dbUserId);
}

/**
 * Check if current user has a specific permission
 */
export async function checkPermission(
    resource: PermissionResource,
    action: PermissionAction,
    departmentId?: string
): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return false;
    }

    return can(session.user.dbUserId, resource, action, { departmentId });
}

/**
 * Check multiple permissions at once
 */
export async function checkPermissions(
    checks: Array<{ resource: PermissionResource; action: PermissionAction }>
): Promise<Map<string, boolean>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return new Map(checks.map((c) => [`${c.resource}:${c.action}`, false]));
    }

    const { authorizationService } = await import("@/lib/domains/permission");
    return authorizationService.checkPermissions(session.user.dbUserId, checks);
}

// =============================================================================
// ADMIN MANAGEMENT (for the management pages)
// =============================================================================

/**
 * List users with their roles (for admin page)
 */
export async function listUsersWithRoles(search?: string): Promise<
    Result<
        Array<{
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            position: string | null;
            departmentId: string | null;
            departmentName: string | null;
            roles: Array<{
                id: string;
                code: string;
                name: string;
                userRoleId: string;
                departmentId: string | null;
                departmentName: string | null;
            }>;
        }>
    >
> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const users = await prisma.user.findMany({
        where: search
            ? {
                OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                ],
            }
            : undefined,
        include: {
            department: { select: { id: true, name: true } },
            userRoles: {
                where: { isActive: true },
                include: {
                    role: { select: { id: true, code: true, name: true } },
                    department: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { firstName: "asc" },
        take: 100,
    });

    return {
        success: true,
        data: users.map((u) => ({
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            position: u.position,
            departmentId: u.department?.id ?? null,
            departmentName: u.department?.name ?? null,
            roles: u.userRoles.map((ur) => ({
                id: ur.role.id,
                code: ur.role.code,
                name: ur.role.name,
                userRoleId: ur.id,
                departmentId: ur.department?.id ?? null,
                departmentName: ur.department?.name ?? null,
            })),
        })),
    };
}

/**
 * Get count of users with a specific role
 */
export async function getRoleUserCount(roleId: string): Promise<number> {
    const users = await userRoleRepository.getUsersByRole(roleId);
    return users.length;
}
