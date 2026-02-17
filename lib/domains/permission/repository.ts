/**
 * Permission Domain - Repository Layer
 * 
 * Data access layer for Permission, Role, and Authorization entities
 * 
 * @module lib/domains/permission/repository
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PermissionResource } from "@/lib/shared/types";
import type {
    PermissionEntity,
    RoleEntity,
    RoleWithPermissions,
    UserRoleEntity,
    UserRoleWithDetails,
    CreatePermissionInput,
    UpdatePermissionInput,
    CreateRoleInput,
    UpdateRoleInput,
    AssignRoleInput,
    GrantPermissionInput,
    PermissionFilterCriteria,
    RoleFilterCriteria,
} from "./types";

// =============================================================================
// PERMISSION REPOSITORY
// =============================================================================

export const permissionRepository = {
    /**
     * Find permission by ID
     */
    async findById(id: string): Promise<PermissionEntity | null> {
        return prisma.permission.findUnique({
            where: { id },
        });
    },

    /**
     * Find permission by code
     */
    async findByCode(code: string): Promise<PermissionEntity | null> {
        return prisma.permission.findUnique({
            where: { code },
        });
    },

    /**
     * Find all permissions with optional filters
     */
    async findAll(filters?: PermissionFilterCriteria): Promise<PermissionEntity[]> {
        const where: Prisma.PermissionWhereInput = {};

        if (filters?.resource) where.resource = filters.resource;
        if (filters?.action) where.action = filters.action;
        if (filters?.scope) where.scope = filters.scope;
        if (filters?.isActive !== undefined) where.isActive = filters.isActive;
        if (filters?.search) {
            where.OR = [
                { code: { contains: filters.search, mode: "insensitive" } },
                { name: { contains: filters.search, mode: "insensitive" } },
                { description: { contains: filters.search, mode: "insensitive" } },
            ];
        }

        return prisma.permission.findMany({
            where,
            orderBy: [{ resource: "asc" }, { action: "asc" }],
        });
    },

    /**
     * Find permissions by resource
     */
    async findByResource(resource: PermissionResource): Promise<PermissionEntity[]> {
        return prisma.permission.findMany({
            where: { resource, isActive: true },
            orderBy: { action: "asc" },
        });
    },

    /**
     * Create a new permission
     */
    async create(data: CreatePermissionInput): Promise<PermissionEntity> {
        return prisma.permission.create({
            data: {
                code: data.code,
                name: data.name,
                description: data.description,
                resource: data.resource,
                action: data.action,
                scope: data.scope ?? "OWN",
                isSystem: data.isSystem ?? false,
            },
        });
    },

    /**
     * Update a permission
     */
    async update(id: string, data: UpdatePermissionInput): Promise<PermissionEntity> {
        return prisma.permission.update({
            where: { id },
            data,
        });
    },

    /**
     * Delete a permission (soft delete by deactivating)
     */
    async deactivate(id: string): Promise<PermissionEntity> {
        return prisma.permission.update({
            where: { id },
            data: { isActive: false },
        });
    },

    /**
     * Permanently delete a permission (only non-system permissions)
     */
    async delete(id: string): Promise<void> {
        await prisma.permission.delete({
            where: { id, isSystem: false },
        });
    },

    /**
     * Bulk create permissions (for seeding)
     */
    async createMany(permissions: CreatePermissionInput[]): Promise<number> {
        const result = await prisma.permission.createMany({
            data: permissions.map((p) => ({
                code: p.code,
                name: p.name,
                description: p.description,
                resource: p.resource,
                action: p.action,
                scope: p.scope ?? "OWN",
                isSystem: p.isSystem ?? false,
            })),
            skipDuplicates: true,
        });
        return result.count;
    },
};

// =============================================================================
// ROLE REPOSITORY
// =============================================================================

export const roleRepository = {
    /**
     * Find role by ID
     */
    async findById(id: string): Promise<RoleEntity | null> {
        return prisma.role.findUnique({
            where: { id },
        });
    },

    /**
     * Find role by code
     */
    async findByCode(code: string): Promise<RoleEntity | null> {
        return prisma.role.findUnique({
            where: { code },
        });
    },

    /**
     * Find role with permissions
     */
    async findWithPermissions(id: string): Promise<RoleWithPermissions | null> {
        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                rolePermissions: {
                    include: {
                        permission: true,
                    },
                    where: {
                        permission: { isActive: true },
                    },
                },
            },
        });

        if (!role) return null;

        return {
            ...role,
            permissions: role.rolePermissions.map((rp) => rp.permission),
        };
    },

    /**
     * Find role by code with permissions
     */
    async findByCodeWithPermissions(code: string): Promise<RoleWithPermissions | null> {
        const role = await prisma.role.findUnique({
            where: { code },
            include: {
                rolePermissions: {
                    include: {
                        permission: true,
                    },
                    where: {
                        permission: { isActive: true },
                    },
                },
            },
        });

        if (!role) return null;

        return {
            ...role,
            permissions: role.rolePermissions.map((rp) => rp.permission),
        };
    },

    /**
     * Find all roles with optional filters
     */
    async findAll(filters?: RoleFilterCriteria): Promise<RoleEntity[]> {
        const where: Prisma.RoleWhereInput = {};

        if (filters?.isActive !== undefined) where.isActive = filters.isActive;
        if (filters?.isSystem !== undefined) where.isSystem = filters.isSystem;
        if (filters?.minLevel !== undefined) where.level = { gte: filters.minLevel };
        if (filters?.maxLevel !== undefined) {
            where.level = { ...((where.level as object) || {}), lte: filters.maxLevel };
        }
        if (filters?.search) {
            where.OR = [
                { code: { contains: filters.search, mode: "insensitive" } },
                { name: { contains: filters.search, mode: "insensitive" } },
                { description: { contains: filters.search, mode: "insensitive" } },
            ];
        }

        return prisma.role.findMany({
            where,
            orderBy: [{ level: "desc" }, { name: "asc" }],
        });
    },

    /**
     * Create a new role
     */
    async create(data: CreateRoleInput): Promise<RoleEntity> {
        return prisma.role.create({
            data: {
                code: data.code,
                name: data.name,
                description: data.description,
                level: data.level ?? 0,
                parentRoleId: data.parentRoleId,
                isSystem: data.isSystem ?? false,
            },
        });
    },

    /**
     * Update a role
     */
    async update(id: string, data: UpdateRoleInput): Promise<RoleEntity> {
        return prisma.role.update({
            where: { id },
            data,
        });
    },

    /**
     * Delete a role (soft delete by deactivating)
     */
    async deactivate(id: string): Promise<RoleEntity> {
        return prisma.role.update({
            where: { id },
            data: { isActive: false },
        });
    },

    /**
     * Permanently delete a role (only non-system roles)
     */
    async delete(id: string): Promise<void> {
        await prisma.role.delete({
            where: { id, isSystem: false },
        });
    },

    /**
     * Grant permission to role
     */
    async grantPermission(data: GrantPermissionInput): Promise<void> {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: data.roleId,
                    permissionId: data.permissionId,
                },
            },
            update: {},
            create: {
                roleId: data.roleId,
                permissionId: data.permissionId,
                grantedById: data.grantedById,
            },
        });
    },

    /**
     * Revoke permission from role
     */
    async revokePermission(roleId: string, permissionId: string): Promise<void> {
        await prisma.rolePermission.deleteMany({
            where: { roleId, permissionId },
        });
    },

    /**
     * Get all permissions for a role
     */
    async getPermissions(roleId: string): Promise<PermissionEntity[]> {
        const rolePermissions = await prisma.rolePermission.findMany({
            where: { roleId },
            include: {
                permission: true,
            },
        });
        return rolePermissions.map((rp) => rp.permission);
    },

    /**
     * Bulk grant permissions to role
     */
    async grantPermissions(
        roleId: string,
        permissionIds: string[],
        grantedById?: string
    ): Promise<number> {
        const result = await prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
                roleId,
                permissionId,
                grantedById,
            })),
            skipDuplicates: true,
        });
        return result.count;
    },

    /**
     * Replace all permissions for a role
     */
    async setPermissions(
        roleId: string,
        permissionIds: string[],
        grantedById?: string
    ): Promise<void> {
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId } }),
            prisma.rolePermission.createMany({
                data: permissionIds.map((permissionId) => ({
                    roleId,
                    permissionId,
                    grantedById,
                })),
            }),
        ]);
    },
};

// =============================================================================
// USER ROLE REPOSITORY
// =============================================================================

export const userRoleRepository = {
    /**
     * Assign role to user
     */
    async assign(data: AssignRoleInput): Promise<UserRoleEntity> {
        // Prisma doesn't support upsert with nullable fields in composite unique keys
        // Use find + update/create instead
        const existing = await prisma.userRole.findFirst({
            where: {
                userId: data.userId,
                roleId: data.roleId,
                departmentId: data.departmentId ?? null,
            },
        });

        if (existing) {
            return prisma.userRole.update({
                where: { id: existing.id },
                data: {
                    isActive: true,
                    expiresAt: data.expiresAt,
                    assignedById: data.assignedById,
                    assignedAt: new Date(),
                },
            });
        }

        return prisma.userRole.create({
            data: {
                userId: data.userId,
                roleId: data.roleId,
                departmentId: data.departmentId ?? null,
                assignedById: data.assignedById,
                expiresAt: data.expiresAt,
            },
        });
    },

    /**
     * Revoke role from user
     */
    async revoke(userId: string, roleId: string, departmentId?: string): Promise<void> {
        await prisma.userRole.updateMany({
            where: {
                userId,
                roleId,
                departmentId: departmentId ?? null,
            },
            data: { isActive: false },
        });
    },

    /**
     * Get all roles for a user
     */
    async getUserRoles(userId: string): Promise<UserRoleWithDetails[]> {
        const now = new Date();
        const userRoles = await prisma.userRole.findMany({
            where: {
                userId,
                isActive: true,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true,
                            },
                            where: {
                                permission: { isActive: true },
                            },
                        },
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        shortName: true,
                    },
                },
            },
        });

        return userRoles
            .filter((ur) => ur.role.isActive)
            .map((ur) => ({
                ...ur,
                role: {
                    ...ur.role,
                    permissions: ur.role.rolePermissions.map((rp) => rp.permission),
                },
            }));
    },

    /**
     * Get all users with a specific role
     */
    async getUsersByRole(roleId: string, departmentId?: string): Promise<UserRoleEntity[]> {
        const now = new Date();
        const where: Prisma.UserRoleWhereInput = {
            roleId,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        };

        if (departmentId !== undefined) {
            where.departmentId = departmentId;
        }

        return prisma.userRole.findMany({ where });
    },

    /**
     * Check if user has a specific role (globally or in department)
     */
    async hasRole(userId: string, roleCode: string, departmentId?: string): Promise<boolean> {
        const now = new Date();
        const count = await prisma.userRole.count({
            where: {
                userId,
                role: { code: roleCode, isActive: true },
                isActive: true,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                ...(departmentId !== undefined
                    ? { OR: [{ departmentId }, { departmentId: null }] }
                    : {}),
            },
        });
        return count > 0;
    },

    /**
     * Get all effective permissions for a user
     */
    async getAllUserPermissions(
        userId: string,
        departmentId?: string
    ): Promise<PermissionEntity[]> {
        const now = new Date();
        const whereUserRole: Prisma.UserRoleWhereInput = {
            userId,
            isActive: true,
            role: { isActive: true },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        };

        // If departmentId is provided, include both global and department-specific roles
        if (departmentId) {
            whereUserRole.OR = [
                { departmentId: null, expiresAt: null },
                { departmentId: null, expiresAt: { gt: now } },
                { departmentId, expiresAt: null },
                { departmentId, expiresAt: { gt: now } },
            ];
        }

        const userRoles = await prisma.userRole.findMany({
            where: whereUserRole,
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true,
                            },
                            where: {
                                permission: { isActive: true },
                            },
                        },
                    },
                },
            },
        });

        // Collect all permissions, avoiding duplicates
        const permissionMap = new Map<string, PermissionEntity>();
        for (const userRole of userRoles) {
            for (const rp of userRole.role.rolePermissions) {
                if (!permissionMap.has(rp.permission.id)) {
                    permissionMap.set(rp.permission.id, rp.permission);
                }
            }
        }

        return Array.from(permissionMap.values());
    },

    /**
     * Check if user has specific permission
     */
    async hasPermission(
        userId: string,
        permissionCode: string,
        departmentId?: string
    ): Promise<boolean> {
        const now = new Date();
        const whereUserRole: Prisma.UserRoleWhereInput = {
            userId,
            isActive: true,
            role: {
                isActive: true,
                rolePermissions: {
                    some: {
                        permission: { code: permissionCode, isActive: true },
                    },
                },
            },
        };

        // Include both global and department-specific roles
        if (departmentId) {
            whereUserRole.OR = [
                { departmentId: null, expiresAt: null },
                { departmentId: null, expiresAt: { gt: now } },
                { departmentId, expiresAt: null },
                { departmentId, expiresAt: { gt: now } },
            ];
        } else {
            whereUserRole.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
        }

        const count = await prisma.userRole.count({ where: whereUserRole });
        return count > 0;
    },
};
