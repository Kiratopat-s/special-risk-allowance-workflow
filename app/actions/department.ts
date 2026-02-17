"use server";

/**
 * Department Server Actions
 * 
 * Server actions for managing departments
 * 
 * @module app/actions/department
 */

import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { departmentService } from "@/lib/domains/department";
import type { Result } from "@/lib/shared/types";
import type {
    DepartmentEntity,
    DepartmentWithHierarchy,
    CreateDepartmentInput,
    UpdateDepartmentInput,
} from "@/lib/domains/department";

/**
 * List all active departments (for dropdowns and selection)
 */
export async function listDepartments(): Promise<Result<DepartmentEntity[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    return departmentService.getAllActive();
}

/**
 * List all departments with filters (for management page)
 */
export async function listAllDepartments(filters?: {
    search?: string;
    isActive?: boolean;
}): Promise<Result<DepartmentWithHierarchy[]>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canList = await can(session.user.dbUserId, "DEPARTMENT", "LIST");
    if (!canList) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    // Fetch all departments with hierarchy
    const { prisma } = await import("@/lib/db");
    type WhereClause = {
        OR?: Array<{
            name?: { contains: string; mode: "insensitive" };
            shortName?: { contains: string; mode: "insensitive" };
        }>;
        isActive?: boolean;
    };
    const where: WhereClause = {};

    if (filters?.search) {
        where.OR = [
            { name: { contains: filters.search, mode: "insensitive" } },
            { shortName: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
    }

    const departments = await prisma.department.findMany({
        where,
        include: {
            parent: {
                select: {
                    id: true,
                    name: true,
                    shortName: true,
                },
            },
            children: {
                select: {
                    id: true,
                    name: true,
                    shortName: true,
                },
            },
            _count: {
                select: {
                    users: true,
                },
            },
        },
        orderBy: { name: "asc" },
    });

    return { success: true, data: departments };
}

/**
 * Get department by ID
 */
export async function getDepartment(id: string): Promise<Result<DepartmentWithHierarchy>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canRead = await can(session.user.dbUserId, "DEPARTMENT", "READ");
    if (!canRead) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return departmentService.getWithHierarchy(id);
}

/**
 * Create a new department
 */
export async function createDepartment(
    data: CreateDepartmentInput
): Promise<Result<DepartmentEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canCreate = await can(session.user.dbUserId, "DEPARTMENT", "CREATE");
    if (!canCreate) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return departmentService.create(data, session.user.dbUserId);
}

/**
 * Update a department
 */
export async function updateDepartment(
    id: string,
    data: UpdateDepartmentInput
): Promise<Result<DepartmentEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canUpdate = await can(session.user.dbUserId, "DEPARTMENT", "UPDATE");
    if (!canUpdate) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return departmentService.update(id, data, session.user.dbUserId);
}

/**
 * Delete a department
 */
export async function deleteDepartment(id: string): Promise<Result<void>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canDelete = await can(session.user.dbUserId, "DEPARTMENT", "DELETE");
    if (!canDelete) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return departmentService.delete(id, session.user.dbUserId);
}

/**
 * Toggle department active status
 */
export async function toggleDepartmentStatus(id: string): Promise<Result<DepartmentEntity>> {
    const session = await auth();
    if (!session?.user?.dbUserId) {
        return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const canUpdate = await can(session.user.dbUserId, "DEPARTMENT", "UPDATE");
    if (!canUpdate) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    return departmentService.toggleActive(id, session.user.dbUserId);
}
