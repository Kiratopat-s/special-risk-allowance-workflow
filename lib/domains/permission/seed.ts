/**
 * Permission Seeding - Default Roles and Permissions
 * 
 * This module provides default roles and permissions for the application.
 * Run this during application setup or migration.
 * 
 * @module lib/domains/permission/seed
 */

import { permissionService, roleService } from "./service";
import type { CreatePermissionInput, CreateRoleInput } from "./types";

// =============================================================================
// DEFAULT PERMISSIONS
// =============================================================================

/**
 * Default system permissions organized by resource
 */
export const DEFAULT_PERMISSIONS: CreatePermissionInput[] = [
    // USER PERMISSIONS
    { code: "user:create", name: "Create Users", resource: "USER", action: "CREATE", scope: "ALL", isSystem: true },
    { code: "user:read", name: "Read Users", resource: "USER", action: "READ", scope: "OWN", isSystem: true },
    { code: "user:read:all", name: "Read All Users", resource: "USER", action: "READ", scope: "ALL", isSystem: true },
    { code: "user:read:department", name: "Read Department Users", resource: "USER", action: "READ", scope: "DEPARTMENT", isSystem: true },
    { code: "user:update", name: "Update Own Profile", resource: "USER", action: "UPDATE", scope: "OWN", isSystem: true },
    { code: "user:update:all", name: "Update Any User", resource: "USER", action: "UPDATE", scope: "ALL", isSystem: true },
    { code: "user:delete", name: "Delete Users", resource: "USER", action: "DELETE", scope: "ALL", isSystem: true },
    { code: "user:list", name: "List Users", resource: "USER", action: "LIST", scope: "ALL", isSystem: true },
    { code: "user:manage", name: "Manage Users", resource: "USER", action: "MANAGE", scope: "ALL", isSystem: true },

    // DEPARTMENT PERMISSIONS
    { code: "department:create", name: "Create Departments", resource: "DEPARTMENT", action: "CREATE", scope: "ALL", isSystem: true },
    { code: "department:read", name: "Read Departments", resource: "DEPARTMENT", action: "READ", scope: "ALL", isSystem: true },
    { code: "department:update", name: "Update Departments", resource: "DEPARTMENT", action: "UPDATE", scope: "ALL", isSystem: true },
    { code: "department:delete", name: "Delete Departments", resource: "DEPARTMENT", action: "DELETE", scope: "ALL", isSystem: true },
    { code: "department:list", name: "List Departments", resource: "DEPARTMENT", action: "LIST", scope: "ALL", isSystem: true },
    { code: "department:manage", name: "Manage Departments", resource: "DEPARTMENT", action: "MANAGE", scope: "ALL", isSystem: true },

    // ROLE & PERMISSION MANAGEMENT
    { code: "role:create", name: "Create Roles", resource: "ROLE", action: "CREATE", scope: "ALL", isSystem: true },
    { code: "role:read", name: "Read Roles", resource: "ROLE", action: "READ", scope: "ALL", isSystem: true },
    { code: "role:update", name: "Update Roles", resource: "ROLE", action: "UPDATE", scope: "ALL", isSystem: true },
    { code: "role:delete", name: "Delete Roles", resource: "ROLE", action: "DELETE", scope: "ALL", isSystem: true },
    { code: "role:list", name: "List Roles", resource: "ROLE", action: "LIST", scope: "ALL", isSystem: true },
    { code: "role:manage", name: "Manage Roles", resource: "ROLE", action: "MANAGE", scope: "ALL", isSystem: true },
    { code: "permission:read", name: "Read Permissions", resource: "PERMISSION", action: "READ", scope: "ALL", isSystem: true },
    { code: "permission:list", name: "List Permissions", resource: "PERMISSION", action: "LIST", scope: "ALL", isSystem: true },
    { code: "permission:manage", name: "Manage Permissions", resource: "PERMISSION", action: "MANAGE", scope: "ALL", isSystem: true },

    // EXPENSE CLAIM PERMISSIONS
    { code: "expense-claim:create", name: "Create Expense Claims", resource: "EXPENSE_CLAIM", action: "CREATE", scope: "OWN", isSystem: true },
    { code: "expense-claim:read", name: "Read Own Expense Claims", resource: "EXPENSE_CLAIM", action: "READ", scope: "OWN", isSystem: true },
    { code: "expense-claim:read:department", name: "Read Department Expense Claims", resource: "EXPENSE_CLAIM", action: "READ", scope: "DEPARTMENT", isSystem: true },
    { code: "expense-claim:read:all", name: "Read All Expense Claims", resource: "EXPENSE_CLAIM", action: "READ", scope: "ALL", isSystem: true },
    { code: "expense-claim:update", name: "Update Own Expense Claims", resource: "EXPENSE_CLAIM", action: "UPDATE", scope: "OWN", isSystem: true },
    { code: "expense-claim:update:all", name: "Update Any Expense Claim", resource: "EXPENSE_CLAIM", action: "UPDATE", scope: "ALL", isSystem: true },
    { code: "expense-claim:delete", name: "Delete Own Expense Claims", resource: "EXPENSE_CLAIM", action: "DELETE", scope: "OWN", isSystem: true },
    { code: "expense-claim:delete:all", name: "Delete Any Expense Claim", resource: "EXPENSE_CLAIM", action: "DELETE", scope: "ALL", isSystem: true },
    { code: "expense-claim:list", name: "List Own Expense Claims", resource: "EXPENSE_CLAIM", action: "LIST", scope: "OWN", isSystem: true },
    { code: "expense-claim:list:department", name: "List Department Expense Claims", resource: "EXPENSE_CLAIM", action: "LIST", scope: "DEPARTMENT", isSystem: true },
    { code: "expense-claim:list:all", name: "List All Expense Claims", resource: "EXPENSE_CLAIM", action: "LIST", scope: "ALL", isSystem: true },
    { code: "expense-claim:submit", name: "Submit Expense Claims", resource: "EXPENSE_CLAIM", action: "SUBMIT", scope: "OWN", isSystem: true },
    { code: "expense-claim:recheck:all", name: "Recheck All Expense Claims", resource: "EXPENSE_CLAIM", action: "RECHECK", scope: "ALL", isSystem: true },
    { code: "expense-claim:reject:all", name: "Reject All Expense Claims", resource: "EXPENSE_CLAIM", action: "REJECT", scope: "ALL", isSystem: true },
    { code: "expense-claim:collect:all", name: "Collect All Expense Claims", resource: "EXPENSE_CLAIM", action: "COLLECT", scope: "ALL", isSystem: true },
    { code: "expense-claim:remove:all", name: "Remove Claims From Draft Collections", resource: "EXPENSE_CLAIM", action: "REMOVE", scope: "ALL", isSystem: true },
    { code: "expense-claim:flag:all", name: "Flag Suspicious Expense Claims", resource: "EXPENSE_CLAIM", action: "FLAG", scope: "ALL", isSystem: true },
    { code: "expense-claim:resolve:all", name: "Resolve Suspicious Expense Claims", resource: "EXPENSE_CLAIM", action: "RESOLVE", scope: "ALL", isSystem: true },
    { code: "expense-claim:cancel", name: "Cancel Own Expense Claims", resource: "EXPENSE_CLAIM", action: "CANCEL", scope: "OWN", isSystem: true },
    { code: "expense-claim:manage", name: "Manage Expense Claims", resource: "EXPENSE_CLAIM", action: "MANAGE", scope: "ALL", isSystem: true },

    // OFF-SITE WORK PERMISSIONS
    { code: "off-site-work:create", name: "Create Off-Site Work", resource: "OFF_SITE_WORK", action: "CREATE", scope: "OWN", isSystem: true },
    { code: "off-site-work:read", name: "Read Own Off-Site Work", resource: "OFF_SITE_WORK", action: "READ", scope: "OWN", isSystem: true },
    { code: "off-site-work:read:all", name: "Read All Off-Site Work", resource: "OFF_SITE_WORK", action: "READ", scope: "ALL", isSystem: true },
    { code: "off-site-work:update", name: "Update Own Off-Site Work", resource: "OFF_SITE_WORK", action: "UPDATE", scope: "OWN", isSystem: true },
    { code: "off-site-work:update:all", name: "Update Any Off-Site Work", resource: "OFF_SITE_WORK", action: "UPDATE", scope: "ALL", isSystem: true },
    { code: "off-site-work:delete", name: "Delete Own Off-Site Work", resource: "OFF_SITE_WORK", action: "DELETE", scope: "OWN", isSystem: true },
    { code: "off-site-work:delete:all", name: "Delete Any Off-Site Work", resource: "OFF_SITE_WORK", action: "DELETE", scope: "ALL", isSystem: true },
    { code: "off-site-work:list", name: "List Off-Site Work", resource: "OFF_SITE_WORK", action: "LIST", scope: "OWN", isSystem: true },
    { code: "off-site-work:list:all", name: "List All Off-Site Work", resource: "OFF_SITE_WORK", action: "LIST", scope: "ALL", isSystem: true },
    { code: "off-site-work:manage", name: "Manage Off-Site Work", resource: "OFF_SITE_WORK", action: "MANAGE", scope: "ALL", isSystem: true },

    // MONTHLY REQUEST PERMISSIONS
    { code: "monthly-request:create", name: "Create Monthly Requests", resource: "MONTHLY_REQUEST", action: "CREATE", scope: "ALL", isSystem: true },
    { code: "monthly-request:read:all", name: "Read All Monthly Requests", resource: "MONTHLY_REQUEST", action: "READ", scope: "ALL", isSystem: true },
    { code: "monthly-request:update", name: "Update Draft Monthly Requests", resource: "MONTHLY_REQUEST", action: "UPDATE", scope: "ALL", isSystem: true },
    { code: "monthly-request:list", name: "List Monthly Requests", resource: "MONTHLY_REQUEST", action: "LIST", scope: "ALL", isSystem: true },
    { code: "monthly-request:cancel", name: "Cancel Draft Monthly Requests", resource: "MONTHLY_REQUEST", action: "CANCEL", scope: "ALL", isSystem: true },
    { code: "monthly-request:finalize", name: "Finalize Monthly Requests", resource: "MONTHLY_REQUEST", action: "FINALIZE", scope: "ALL", isSystem: true },
    { code: "monthly-request:complete", name: "Record Paper Approval", resource: "MONTHLY_REQUEST", action: "COMPLETE", scope: "ALL", isSystem: true },
    { code: "monthly-request:void", name: "Void Monthly Requests", resource: "MONTHLY_REQUEST", action: "VOID", scope: "ALL", isSystem: true },
    { code: "monthly-request:print", name: "Print Monthly Requests", resource: "MONTHLY_REQUEST", action: "PRINT", scope: "ALL", isSystem: true },
    { code: "monthly-request:export", name: "Export Monthly Requests", resource: "MONTHLY_REQUEST", action: "EXPORT", scope: "ALL", isSystem: true },
    { code: "monthly-request:manage", name: "Manage Monthly Requests", resource: "MONTHLY_REQUEST", action: "MANAGE", scope: "ALL", isSystem: true },

    // SIGNATURE PERMISSIONS
    { code: "signature:create", name: "Create Own Signature", resource: "SIGNATURE", action: "CREATE", scope: "OWN", isSystem: true },
    { code: "signature:read", name: "Read Own Signature", resource: "SIGNATURE", action: "READ", scope: "OWN", isSystem: true },
    { code: "signature:read:all", name: "Read All Signatures", resource: "SIGNATURE", action: "READ", scope: "ALL", isSystem: true },
    { code: "signature:update", name: "Update Own Signature", resource: "SIGNATURE", action: "UPDATE", scope: "OWN", isSystem: true },
    { code: "signature:delete", name: "Delete Own Signature", resource: "SIGNATURE", action: "DELETE", scope: "OWN", isSystem: true },
    { code: "signature:manage", name: "Manage Signatures", resource: "SIGNATURE", action: "MANAGE", scope: "ALL", isSystem: true },

    // FILE PERMISSIONS
    { code: "file:create", name: "Upload Files", resource: "FILE", action: "CREATE", scope: "OWN", isSystem: true },
    { code: "file:read", name: "Read Own Files", resource: "FILE", action: "READ", scope: "OWN", isSystem: true },
    { code: "file:read:all", name: "Read All Files", resource: "FILE", action: "READ", scope: "ALL", isSystem: true },
    { code: "file:delete", name: "Delete Own Files", resource: "FILE", action: "DELETE", scope: "OWN", isSystem: true },
    { code: "file:delete:all", name: "Delete Any File", resource: "FILE", action: "DELETE", scope: "ALL", isSystem: true },
    { code: "file:manage", name: "Manage Files", resource: "FILE", action: "MANAGE", scope: "ALL", isSystem: true },

    // ACTION LOG PERMISSIONS
    { code: "action-log:read", name: "Read Own Action Logs", resource: "ACTION_LOG", action: "READ", scope: "OWN", isSystem: true },
    { code: "action-log:read:all", name: "Read All Action Logs", resource: "ACTION_LOG", action: "READ", scope: "ALL", isSystem: true },
    { code: "action-log:list", name: "List Action Logs", resource: "ACTION_LOG", action: "LIST", scope: "ALL", isSystem: true },
    { code: "action-log:export", name: "Export Action Logs", resource: "ACTION_LOG", action: "EXPORT", scope: "ALL", isSystem: true },

    // SYSTEM PERMISSIONS
    { code: "system:manage", name: "System Administration", resource: "SYSTEM", action: "MANAGE", scope: "ALL", isSystem: true },
    { code: "system:export", name: "Export System Data", resource: "SYSTEM", action: "EXPORT", scope: "ALL", isSystem: true },
    { code: "system:import", name: "Import System Data", resource: "SYSTEM", action: "IMPORT", scope: "ALL", isSystem: true },
];

// =============================================================================
// DEFAULT ROLES
// =============================================================================

/**
 * Default system roles
 *
 * employee  — Regular employee with basic permissions (can create OSW, ECD, signature)
 * collector — Employee extended with cross-department review and MRC permissions
 * super-admin — Full system access with all permissions
 */
export const DEFAULT_ROLES: CreateRoleInput[] = [
    {
        code: "super-admin",
        name: "Super Administrator",
        description: "Full system access with all permissions",
        level: 100,
        isSystem: true,
    },
    {
        code: "employee",
        name: "Employee",
        description: "Regular employee with basic permissions",
        level: 10,
        isSystem: true,
    },
    {
        code: "collector",
        name: "Collector",
        description: "Employee extended with permission to collect and manage Monthly Request Collections",
        level: 20,
        isSystem: true,
    },
];

// Base permissions shared by all employees (including collectors).
const EMPLOYEE_BASE_PERMISSIONS = [
    "user:read",
    "user:update",
    // Expense claim — own
    "expense-claim:create",
    "expense-claim:read",
    "expense-claim:update",
    "expense-claim:list",
    "expense-claim:submit",
    "expense-claim:cancel",
    // Off-site work — own (employees create/manage their own OSWs per system flow)
    "off-site-work:create",
    "off-site-work:read",
    "off-site-work:update",
    "off-site-work:delete",
    "off-site-work:list",
    // Signature — own
    "signature:create",
    "signature:read",
    "signature:update",
    "signature:delete",
    // File — own
    "file:create",
    "file:read",
    "file:delete",
];

/**
 * Role-permission mappings (role code -> permission codes)
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
    "super-admin": [
        // Super admin gets ALL permissions via the MANAGE permission for each resource
        "user:manage",
        "department:manage",
        "role:manage",
        "permission:manage",
        "expense-claim:manage",
        "off-site-work:manage",
        "monthly-request:manage",
        "monthly-request:list",
        "signature:manage",
        "file:manage",
        "action-log:read:all",
        "action-log:list",
        "action-log:export",
        "system:manage",
        "system:export",
        "system:import",
    ],
    employee: [
        ...EMPLOYEE_BASE_PERMISSIONS,
    ],
    // -------------------------------------------------------------------------
    // Collector: employee + MRC management
    // -------------------------------------------------------------------------
    collector: [
        ...EMPLOYEE_BASE_PERMISSIONS,
        // Broader read access for collection
        "user:read:department",
        "department:read",
        "expense-claim:read:all",
        "expense-claim:list:all",
        "off-site-work:read:all",
        "off-site-work:list:all",
        "expense-claim:recheck:all",
        "expense-claim:reject:all",
        "expense-claim:collect:all",
        "expense-claim:remove:all",
        "expense-claim:flag:all",
        "expense-claim:resolve:all",
        // MRC management
        "monthly-request:create",
        "monthly-request:read:all",
        "monthly-request:update",
        "monthly-request:list",
        "monthly-request:cancel",
        "monthly-request:finalize",
        "monthly-request:complete",
        "monthly-request:void",
        "monthly-request:print",
        "monthly-request:export",
    ],
};

// =============================================================================
// SEED FUNCTION
// =============================================================================

/**
 * Seed default permissions and roles
 */
export async function seedPermissions(): Promise<{
    permissionsCreated: number;
    rolesCreated: number;
}> {
    // Create permissions
    const permissionResult = await permissionService.createMany(DEFAULT_PERMISSIONS);
    const permissionsCreated = permissionResult.success ? permissionResult.data : 0;

    // Create roles
    let rolesCreated = 0;
    for (const role of DEFAULT_ROLES) {
        const result = await roleService.create(role);
        if (result.success) {
            rolesCreated++;
        }
    }

    // Note: Role-permission assignment should be done separately after
    // both roles and permissions are confirmed to exist in the database

    return { permissionsCreated, rolesCreated };
}

/**
 * Assign default permissions to roles
 * Run after seedPermissions
 */
export async function assignDefaultRolePermissions(): Promise<number> {
    const { prisma } = await import("@/lib/db");
    let assignmentsCreated = 0;

    for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
        // Get role
        const role = await prisma.role.findUnique({ where: { code: roleCode } });
        if (!role) continue;

        // Get permissions
        const permissions = await prisma.permission.findMany({
            where: { code: { in: permissionCodes } },
        });

        // Create assignments
        for (const permission of permissions) {
            try {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId: role.id,
                            permissionId: permission.id,
                        },
                    },
                    update: {},
                    create: {
                        roleId: role.id,
                        permissionId: permission.id,
                    },
                });
                assignmentsCreated++;
            } catch {
                // Skip duplicates
            }
        }
    }

    return assignmentsCreated;
}
