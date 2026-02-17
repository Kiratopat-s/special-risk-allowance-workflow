/**
 * Permission Domain - Public API
 * 
 * Central export point for Permission, Role, and Authorization modules
 * 
 * @module lib/domains/permission
 */

// Types
export type {
    PermissionEntity,
    RoleEntity,
    RoleWithPermissions,
    RoleWithHierarchy,
    UserRoleEntity,
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

// Repository
export {
    permissionRepository,
    roleRepository,
    userRoleRepository,
} from "./repository";

// Services
export {
    permissionService,
    roleService,
    authorizationService,
} from "./service";
