/**
 * Auth Module - Public API
 * 
 * @module lib/auth
 */

export { authEvents, type AuthRequestContext } from "./events";

// Permission utilities
export {
    permissionCode,
    parsePermissionCode,
    can,
    canAny,
    canAll,
    hasRole,
    hasAnyRole,
    createPermissionGuard,
    createAnyPermissionGuard,
    createAllPermissionGuard,
    withPermission,
    withOwnershipPermission,
    type PermissionGuardResult,
} from "./permissions";
