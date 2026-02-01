/**
 * Department Domain - Service Layer
 * 
 * Business logic layer for Department operations
 * 
 * @module lib/domains/department/service
 */

import { departmentRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { ActionType } from "@/lib/shared/types";
import { success, error, type Result } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
    DepartmentEntity,
    DepartmentWithHierarchy,
    DepartmentTreeNode,
    CreateDepartmentInput,
    UpdateDepartmentInput,
    DepartmentFilterCriteria,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

type JsonValue = Prisma.JsonValue;

/**
 * Request context for logging
 */
interface RequestContext {
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
    requestMethod?: string;
}

/**
 * Department Service - Business logic functions
 */
export const departmentService = {
    /**
     * Get department by ID
     */
    async getById(id: string): Promise<Result<DepartmentEntity>> {
        const department = await departmentRepository.findById(id);

        if (!department) {
            return error("Department not found", "DEPARTMENT_NOT_FOUND");
        }

        return success(department);
    },

    /**
     * Get department with hierarchy details
     */
    async getWithHierarchy(id: string): Promise<Result<DepartmentWithHierarchy>> {
        const department = await departmentRepository.findWithHierarchy(id);

        if (!department) {
            return error("Department not found", "DEPARTMENT_NOT_FOUND");
        }

        return success(department);
    },

    /**
     * Create a new department
     */
    async create(
        data: CreateDepartmentInput,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<DepartmentEntity>> {
        // Check if department with same name exists
        const existingByName = await departmentRepository.findByName(data.name);
        if (existingByName) {
            return error("Department with this name already exists", "DUPLICATE_NAME");
        }

        // Check if short name is provided and unique
        if (data.shortName) {
            const existingByShortName = await departmentRepository.findByShortName(
                data.shortName
            );
            if (existingByShortName) {
                return error(
                    "Department with this short name already exists",
                    "DUPLICATE_SHORT_NAME"
                );
            }
        }

        // Validate parent if provided
        if (data.parentId) {
            const parent = await departmentRepository.findById(data.parentId);
            if (!parent) {
                return error("Parent department not found", "PARENT_NOT_FOUND");
            }
        }

        const department = await departmentRepository.create(data);

        // Log creation
        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.DEPARTMENT_CREATED,
            actionDescription: `Department "${department.name}" created`,
            targetDepartmentId: department.id,
            newData: data as unknown as JsonValue,
            ...context,
        });

        return success(department, "Department created successfully");
    },

    /**
     * Update a department
     */
    async update(
        id: string,
        data: UpdateDepartmentInput,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<DepartmentEntity>> {
        const existing = await departmentRepository.findById(id);

        if (!existing) {
            return error("Department not found", "DEPARTMENT_NOT_FOUND");
        }

        // Check name uniqueness if changing
        if (data.name && data.name !== existing.name) {
            const existingByName = await departmentRepository.findByName(data.name);
            if (existingByName) {
                return error("Department with this name already exists", "DUPLICATE_NAME");
            }
        }

        // Check short name uniqueness if changing
        if (data.shortName && data.shortName !== existing.shortName) {
            const existingByShortName = await departmentRepository.findByShortName(
                data.shortName
            );
            if (existingByShortName) {
                return error(
                    "Department with this short name already exists",
                    "DUPLICATE_SHORT_NAME"
                );
            }
        }

        // Prevent circular reference
        if (data.parentId === id) {
            return error(
                "Department cannot be its own parent",
                "CIRCULAR_REFERENCE"
            );
        }

        const previousData = {
            name: existing.name,
            shortName: existing.shortName,
            parentId: existing.parentId,
        };

        const department = await departmentRepository.update(id, data);

        // Log update
        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.DEPARTMENT_UPDATED,
            actionDescription: `Department "${department.name}" updated`,
            targetDepartmentId: department.id,
            previousData: previousData as unknown as JsonValue,
            newData: data as unknown as JsonValue,
            ...context,
        });

        return success(department, "Department updated successfully");
    },

    /**
     * Delete a department
     */
    async delete(
        id: string,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<void>> {
        const department = await departmentRepository.findById(id);

        if (!department) {
            return error("Department not found", "DEPARTMENT_NOT_FOUND");
        }

        // Check if department has users
        const userCount = await departmentRepository.countUsers(id);
        if (userCount > 0) {
            return error(
                `Cannot delete department with ${userCount} assigned users`,
                "HAS_USERS"
            );
        }

        // Check if department has children
        const hasChildren = await departmentRepository.hasChildren(id);
        if (hasChildren) {
            return error(
                "Cannot delete department with child departments",
                "HAS_CHILDREN"
            );
        }

        await departmentRepository.delete(id);

        // Log deletion
        await actionLogService.log({
            userId: actorId,
            actionType: ActionType.DEPARTMENT_DELETED,
            actionDescription: `Department "${department.name}" deleted`,
            previousData: {
                name: department.name,
                shortName: department.shortName,
            } as unknown as JsonValue,
            ...context,
        });

        return success(undefined, "Department deleted successfully");
    },

    /**
     * List departments with filters
     */
    async list(
        criteria: DepartmentFilterCriteria
    ): Promise<Result<PaginatedResult<DepartmentEntity>>> {
        const result = await departmentRepository.findMany(criteria);
        return success(result);
    },

    /**
     * Get all active departments (for dropdowns)
     */
    async getAllActive(): Promise<Result<DepartmentEntity[]>> {
        const departments = await departmentRepository.findAllActive();
        return success(departments);
    },

    /**
     * Get department tree structure
     */
    async getTree(): Promise<Result<DepartmentTreeNode[]>> {
        const rootDepartments = await departmentRepository.findRootDepartments();

        const buildTree = async (
            dept: DepartmentWithHierarchy
        ): Promise<DepartmentTreeNode> => {
            const childrenWithHierarchy = await Promise.all(
                dept.children.map(async (child) => {
                    const fullChild = await departmentRepository.findWithHierarchy(child.id);
                    return fullChild ? buildTree(fullChild) : null;
                })
            );

            return {
                id: dept.id,
                name: dept.name,
                shortName: dept.shortName,
                description: dept.description,
                parentId: dept.parentId,
                isActive: dept.isActive,
                createdAt: dept.createdAt,
                updatedAt: dept.updatedAt,
                children: childrenWithHierarchy.filter(Boolean) as DepartmentTreeNode[],
                userCount: dept._count?.users ?? 0,
            };
        };

        const tree = await Promise.all(rootDepartments.map(buildTree));
        return success(tree);
    },

    /**
     * Toggle department active status
     */
    async toggleActive(
        id: string,
        actorId: string,
        context?: RequestContext
    ): Promise<Result<DepartmentEntity>> {
        const department = await departmentRepository.findById(id);

        if (!department) {
            return error("Department not found", "DEPARTMENT_NOT_FOUND");
        }

        return this.update(
            id,
            { isActive: !department.isActive },
            actorId,
            context
        );
    },
};
