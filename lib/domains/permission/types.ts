/**
 * Permission Domain - Entity Types
 * 
 * Types for Permission, Role, and Authorization entities
 * 
 * @module lib/domains/permission/types
 */

import type { PermissionResource, PermissionAction, PermissionScope } from "@/lib/shared/types";

// =============================================================================
// PERMISSION ENTITIES
// =============================================================================

/**
 * Core Permission entity
 */
export interface PermissionEntity {
    id: string;
    code: string;
    name: string;
    description: string | null;
    resource: PermissionResource;
    action: PermissionAction;
    scope: PermissionScope;
    isActive: boolean;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Core Role entity
 */
export interface RoleEntity {
    id: string;
    code: string;
    name: string;
    description: string | null;
    level: number;
    parentRoleId: string | null;
    isActive: boolean;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Role with permissions
 */
export interface RoleWithPermissions extends RoleEntity {
    permissions: PermissionEntity[];
}

/**
 * Role with hierarchy
 */
export interface RoleWithHierarchy extends RoleEntity {
    parentRole: RoleEntity | null;
    childRoles: RoleEntity[];
}

/**
 * User role assignment entity
 */
export interface UserRoleEntity {
    id: string;
    userId: string;
    roleId: string;
    departmentId: string | null;
    assignedById: string | null;
    assignedAt: Date;
    expiresAt: Date | null;
    isActive: boolean;
}

/**
 * User role with full details
 */
export interface UserRoleWithDetails extends UserRoleEntity {
    role: RoleWithPermissions;
    department: {
        id: string;
        name: string;
        shortName: string | null;
    } | null;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Create permission input
 */
export interface CreatePermissionInput {
    code: string;
    name: string;
    description?: string;
    resource: PermissionResource;
    action: PermissionAction;
    scope?: PermissionScope;
    isSystem?: boolean;
}

/**
 * Update permission input
 */
export interface UpdatePermissionInput {
    name?: string;
    description?: string;
    scope?: PermissionScope;
    isActive?: boolean;
}

/**
 * Create role input
 */
export interface CreateRoleInput {
    code: string;
    name: string;
    description?: string;
    level?: number;
    parentRoleId?: string;
    isSystem?: boolean;
}

/**
 * Update role input
 */
export interface UpdateRoleInput {
    name?: string;
    description?: string;
    level?: number;
    parentRoleId?: string | null;
    isActive?: boolean;
}

/**
 * Assign role to user input
 */
export interface AssignRoleInput {
    userId: string;
    roleId: string;
    departmentId?: string;
    assignedById?: string;
    expiresAt?: Date;
}

/**
 * Grant permission to role input
 */
export interface GrantPermissionInput {
    roleId: string;
    permissionId: string;
    grantedById?: string;
}

// =============================================================================
// AUTHORIZATION TYPES
// =============================================================================

/**
 * Permission check request
 */
export interface PermissionCheckRequest {
    userId: string;
    resource: PermissionResource;
    action: PermissionAction;
    targetDepartmentId?: string; // For department-scoped checks
    targetOwnerId?: string; // For ownership checks
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    matchedPermission?: PermissionEntity;
    effectiveScope?: PermissionScope;
}

/**
 * User's effective permissions (cached/computed)
 */
export interface UserEffectivePermissions {
    userId: string;
    permissions: PermissionEntity[];
    roles: RoleEntity[];
    departmentRoles: Map<string, RoleEntity[]>; // Department ID -> Roles
    computedAt: Date;
}

// =============================================================================
// FILTER TYPES
// =============================================================================

/**
 * Permission filter criteria
 */
export interface PermissionFilterCriteria {
    resource?: PermissionResource;
    action?: PermissionAction;
    scope?: PermissionScope;
    isActive?: boolean;
    search?: string;
}

/**
 * Role filter criteria
 */
export interface RoleFilterCriteria {
    isActive?: boolean;
    isSystem?: boolean;
    search?: string;
    minLevel?: number;
    maxLevel?: number;
}
