/**
 * Permission Domain - Service Layer
 * 
 * Business logic layer for Permission, Role, and Authorization operations
 * 
 * @module lib/domains/permission/service
 */

import { permissionRepository, roleRepository, userRoleRepository } from "./repository";
import { success, error, type Result } from "@/lib/shared/types";
import type { PermissionResource, PermissionAction, PermissionScope } from "@/lib/shared/types";
import type {
    PermissionEntity,
    RoleEntity,
    RoleWithPermissions,
    UserRoleWithDetails,
    CreatePermissionInput,
    UpdatePermissionInput,
    CreateRoleInput,
    UpdateRoleInput,
    AssignRoleInput,
    GrantPermissionInput,
    PermissionCheckRequest,
    PermissionCheckResult,
    UserEffectivePermissions,
    PermissionFilterCriteria,
    RoleFilterCriteria,
} from "./types";

// =============================================================================
// PERMISSION SERVICE
// =============================================================================

export const permissionService = {
    /**
     * Get permission by ID
     */
    async getById(id: string): Promise<Result<PermissionEntity>> {
        const permission = await permissionRepository.findById(id);
        if (!permission) {
            return error("Permission not found", "PERMISSION_NOT_FOUND");
        }
        return success(permission);
    },

    /**
     * Get permission by code
     */
    async getByCode(code: string): Promise<Result<PermissionEntity>> {
        const permission = await permissionRepository.findByCode(code);
        if (!permission) {
            return error("Permission not found", "PERMISSION_NOT_FOUND");
        }
        return success(permission);
    },

    /**
     * List all permissions with optional filters
     */
    async list(filters?: PermissionFilterCriteria): Promise<Result<PermissionEntity[]>> {
        const permissions = await permissionRepository.findAll(filters);
        return success(permissions);
    },

    /**
     * List permissions by resource
     */
    async listByResource(resource: PermissionResource): Promise<Result<PermissionEntity[]>> {
        const permissions = await permissionRepository.findByResource(resource);
        return success(permissions);
    },

    /**
     * Create a new permission
     */
    async create(data: CreatePermissionInput): Promise<Result<PermissionEntity>> {
        // Check for duplicate code
        const existing = await permissionRepository.findByCode(data.code);
        if (existing) {
            return error("Permission code already exists", "PERMISSION_CODE_EXISTS");
        }

        const permission = await permissionRepository.create(data);
        return success(permission, "Permission created successfully");
    },

    /**
     * Update a permission
     */
    async update(id: string, data: UpdatePermissionInput): Promise<Result<PermissionEntity>> {
        const existing = await permissionRepository.findById(id);
        if (!existing) {
            return error("Permission not found", "PERMISSION_NOT_FOUND");
        }

        if (existing.isSystem && data.isActive === false) {
            return error("System permissions cannot be deactivated", "SYSTEM_PERMISSION");
        }

        const permission = await permissionRepository.update(id, data);
        return success(permission, "Permission updated successfully");
    },

    /**
     * Deactivate a permission
     */
    async deactivate(id: string): Promise<Result<PermissionEntity>> {
        const existing = await permissionRepository.findById(id);
        if (!existing) {
            return error("Permission not found", "PERMISSION_NOT_FOUND");
        }

        if (existing.isSystem) {
            return error("System permissions cannot be deactivated", "SYSTEM_PERMISSION");
        }

        const permission = await permissionRepository.deactivate(id);
        return success(permission, "Permission deactivated successfully");
    },

    /**
     * Delete a permission permanently
     */
    async delete(id: string): Promise<Result<void>> {
        const existing = await permissionRepository.findById(id);
        if (!existing) {
            return error("Permission not found", "PERMISSION_NOT_FOUND");
        }

        if (existing.isSystem) {
            return error("System permissions cannot be deleted", "SYSTEM_PERMISSION");
        }

        await permissionRepository.delete(id);
        return success(undefined, "Permission deleted successfully");
    },

    /**
     * Create multiple permissions (for seeding)
     */
    async createMany(permissions: CreatePermissionInput[]): Promise<Result<number>> {
        const count = await permissionRepository.createMany(permissions);
        return success(count, `${count} permissions created successfully`);
    },
};

// =============================================================================
// ROLE SERVICE
// =============================================================================

export const roleService = {
    /**
     * Get role by ID
     */
    async getById(id: string): Promise<Result<RoleEntity>> {
        const role = await roleRepository.findById(id);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }
        return success(role);
    },

    /**
     * Get role by code
     */
    async getByCode(code: string): Promise<Result<RoleEntity>> {
        const role = await roleRepository.findByCode(code);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }
        return success(role);
    },

    /**
     * Get role with permissions
     */
    async getWithPermissions(id: string): Promise<Result<RoleWithPermissions>> {
        const role = await roleRepository.findWithPermissions(id);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }
        return success(role);
    },

    /**
     * Get role by code with permissions
     */
    async getByCodeWithPermissions(code: string): Promise<Result<RoleWithPermissions>> {
        const role = await roleRepository.findByCodeWithPermissions(code);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }
        return success(role);
    },

    /**
     * List all roles with optional filters
     */
    async list(filters?: RoleFilterCriteria): Promise<Result<RoleEntity[]>> {
        const roles = await roleRepository.findAll(filters);
        return success(roles);
    },

    /**
     * Create a new role
     */
    async create(data: CreateRoleInput): Promise<Result<RoleEntity>> {
        // Check for duplicate code
        const existing = await roleRepository.findByCode(data.code);
        if (existing) {
            return error("Role code already exists", "ROLE_CODE_EXISTS");
        }

        // Validate parent role if provided
        if (data.parentRoleId) {
            const parentRole = await roleRepository.findById(data.parentRoleId);
            if (!parentRole) {
                return error("Parent role not found", "PARENT_ROLE_NOT_FOUND");
            }
        }

        const role = await roleRepository.create(data);
        return success(role, "Role created successfully");
    },

    /**
     * Update a role
     */
    async update(id: string, data: UpdateRoleInput): Promise<Result<RoleEntity>> {
        const existing = await roleRepository.findById(id);
        if (!existing) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        if (existing.isSystem && data.isActive === false) {
            return error("System roles cannot be deactivated", "SYSTEM_ROLE");
        }

        // Validate parent role if provided
        if (data.parentRoleId) {
            const parentRole = await roleRepository.findById(data.parentRoleId);
            if (!parentRole) {
                return error("Parent role not found", "PARENT_ROLE_NOT_FOUND");
            }
            if (parentRole.id === id) {
                return error("Role cannot be its own parent", "INVALID_PARENT_ROLE");
            }
        }

        const role = await roleRepository.update(id, data);
        return success(role, "Role updated successfully");
    },

    /**
     * Deactivate a role
     */
    async deactivate(id: string): Promise<Result<RoleEntity>> {
        const existing = await roleRepository.findById(id);
        if (!existing) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        if (existing.isSystem) {
            return error("System roles cannot be deactivated", "SYSTEM_ROLE");
        }

        const role = await roleRepository.deactivate(id);
        return success(role, "Role deactivated successfully");
    },

    /**
     * Delete a role permanently
     */
    async delete(id: string): Promise<Result<void>> {
        const existing = await roleRepository.findById(id);
        if (!existing) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        if (existing.isSystem) {
            return error("System roles cannot be deleted", "SYSTEM_ROLE");
        }

        await roleRepository.delete(id);
        return success(undefined, "Role deleted successfully");
    },

    /**
     * Grant permission to role
     */
    async grantPermission(data: GrantPermissionInput): Promise<Result<void>> {
        const role = await roleRepository.findById(data.roleId);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        const permission = await permissionRepository.findById(data.permissionId);
        if (!permission) {
            return error("Permission not found", "PERMISSION_NOT_FOUND");
        }

        await roleRepository.grantPermission(data);
        return success(undefined, "Permission granted successfully");
    },

    /**
     * Revoke permission from role
     */
    async revokePermission(roleId: string, permissionId: string): Promise<Result<void>> {
        const role = await roleRepository.findById(roleId);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        await roleRepository.revokePermission(roleId, permissionId);
        return success(undefined, "Permission revoked successfully");
    },

    /**
     * Get all permissions for a role
     */
    async getPermissions(roleId: string): Promise<Result<PermissionEntity[]>> {
        const role = await roleRepository.findById(roleId);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        const permissions = await roleRepository.getPermissions(roleId);
        return success(permissions);
    },

    /**
     * Set permissions for a role (replaces all existing)
     */
    async setPermissions(
        roleId: string,
        permissionIds: string[],
        grantedById?: string
    ): Promise<Result<void>> {
        const role = await roleRepository.findById(roleId);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        await roleRepository.setPermissions(roleId, permissionIds, grantedById);
        return success(undefined, "Permissions updated successfully");
    },
};

// =============================================================================
// AUTHORIZATION SERVICE
// =============================================================================

export const authorizationService = {
    /**
     * Assign role to user
     */
    async assignRole(data: AssignRoleInput): Promise<Result<void>> {
        const role = await roleRepository.findById(data.roleId);
        if (!role) {
            return error("Role not found", "ROLE_NOT_FOUND");
        }

        if (!role.isActive) {
            return error("Cannot assign inactive role", "INACTIVE_ROLE");
        }

        await userRoleRepository.assign(data);
        return success(undefined, "Role assigned successfully");
    },

    /**
     * Revoke role from user
     */
    async revokeRole(userId: string, roleId: string, departmentId?: string): Promise<Result<void>> {
        await userRoleRepository.revoke(userId, roleId, departmentId);
        return success(undefined, "Role revoked successfully");
    },

    /**
     * Get all roles for a user
     */
    async getUserRoles(userId: string): Promise<Result<UserRoleWithDetails[]>> {
        const userRoles = await userRoleRepository.getUserRoles(userId);
        return success(userRoles);
    },

    /**
     * Check if user has a specific role
     */
    async hasRole(userId: string, roleCode: string, departmentId?: string): Promise<boolean> {
        return userRoleRepository.hasRole(userId, roleCode, departmentId);
    },

    /**
     * Check if user has a specific permission
     */
    async hasPermission(
        userId: string,
        permissionCode: string,
        departmentId?: string
    ): Promise<boolean> {
        return userRoleRepository.hasPermission(userId, permissionCode, departmentId);
    },

    /**
     * Get all effective permissions for a user
     */
    async getUserPermissions(
        userId: string,
        departmentId?: string
    ): Promise<Result<PermissionEntity[]>> {
        const permissions = await userRoleRepository.getAllUserPermissions(userId, departmentId);
        return success(permissions);
    },

    /**
     * Get user's effective permissions (cached structure)
     */
    async getEffectivePermissions(userId: string): Promise<Result<UserEffectivePermissions>> {
        const userRoles = await userRoleRepository.getUserRoles(userId);

        // Build the effective permissions structure
        const permissions: PermissionEntity[] = [];
        const roles: RoleEntity[] = [];
        const departmentRoles = new Map<string, RoleEntity[]>();
        const seenPermissionIds = new Set<string>();
        const seenRoleIds = new Set<string>();

        for (const userRole of userRoles) {
            // Add role (avoid duplicates)
            if (!seenRoleIds.has(userRole.role.id)) {
                seenRoleIds.add(userRole.role.id);
                roles.push(userRole.role);
            }

            // Track department-specific roles
            if (userRole.departmentId) {
                const deptRoles = departmentRoles.get(userRole.departmentId) || [];
                deptRoles.push(userRole.role);
                departmentRoles.set(userRole.departmentId, deptRoles);
            }

            // Add permissions (avoid duplicates)
            for (const permission of userRole.role.permissions) {
                if (!seenPermissionIds.has(permission.id)) {
                    seenPermissionIds.add(permission.id);
                    permissions.push(permission);
                }
            }
        }

        return success({
            userId,
            permissions,
            roles,
            departmentRoles,
            computedAt: new Date(),
        });
    },

    /**
     * Check permission with full context
     */
    async checkPermission(request: PermissionCheckRequest): Promise<PermissionCheckResult> {
        const { userId, resource, action, targetDepartmentId, targetOwnerId } = request;
        const permissionCode = `${resource.toLowerCase()}:${action.toLowerCase()}`;

        // Get all user permissions
        const permissions = await userRoleRepository.getAllUserPermissions(
            userId,
            targetDepartmentId
        );

        // Find matching permission
        const matchingPermissions = permissions.filter(
            (p) => p.resource === resource && p.action === action
        );

        if (matchingPermissions.length === 0) {
            // Check for MANAGE permission which implies all actions
            const managePermission = permissions.find(
                (p) => p.resource === resource && p.action === "MANAGE"
            );

            if (!managePermission) {
                return {
                    allowed: false,
                    reason: `No permission for ${permissionCode}`,
                };
            }

            return {
                allowed: true,
                matchedPermission: managePermission,
                effectiveScope: managePermission.scope,
            };
        }

        // Find the best matching permission (prefer broader scope)
        const scopePriority: Record<PermissionScope, number> = {
            ALL: 3,
            DEPARTMENT: 2,
            OWN: 1,
        };

        const bestPermission = matchingPermissions.sort(
            (a, b) => scopePriority[b.scope] - scopePriority[a.scope]
        )[0];

        // Validate scope
        if (bestPermission.scope === "OWN" && targetOwnerId && targetOwnerId !== userId) {
            return {
                allowed: false,
                reason: "Permission only allows access to own resources",
                matchedPermission: bestPermission,
                effectiveScope: bestPermission.scope,
            };
        }

        return {
            allowed: true,
            matchedPermission: bestPermission,
            effectiveScope: bestPermission.scope,
        };
    },

    /**
     * Check multiple permissions at once
     */
    async checkPermissions(
        userId: string,
        checks: Array<{ resource: PermissionResource; action: PermissionAction }>
    ): Promise<Map<string, boolean>> {
        const permissions = await userRoleRepository.getAllUserPermissions(userId);
        const results = new Map<string, boolean>();

        for (const check of checks) {
            const code = `${check.resource.toLowerCase()}:${check.action.toLowerCase()}`;
            const hasPermission = permissions.some(
                (p) =>
                    (p.resource === check.resource && p.action === check.action) ||
                    (p.resource === check.resource && p.action === "MANAGE")
            );
            results.set(code, hasPermission);
        }

        return results;
    },
};
