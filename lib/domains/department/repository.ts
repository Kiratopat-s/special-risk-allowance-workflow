/**
 * Department Domain - Repository Layer
 * 
 * Data access layer for Department entity
 * 
 * @module lib/domains/department/repository
 */

import { prisma } from "@/lib/db";
import type {
    DepartmentEntity,
    DepartmentWithHierarchy,
    CreateDepartmentInput,
    UpdateDepartmentInput,
    DepartmentFilterCriteria,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

/**
 * Department Repository - Data access functions
 */
export const departmentRepository = {
    /**
     * Find department by ID
     */
    async findById(id: string): Promise<DepartmentEntity | null> {
        return prisma.department.findUnique({
            where: { id },
        });
    },

    /**
     * Find department by name
     */
    async findByName(name: string): Promise<DepartmentEntity | null> {
        return prisma.department.findUnique({
            where: { name },
        });
    },

    /**
     * Find department by short name
     */
    async findByShortName(shortName: string): Promise<DepartmentEntity | null> {
        return prisma.department.findUnique({
            where: { shortName },
        });
    },

    /**
     * Find department with hierarchy details
     */
    async findWithHierarchy(id: string): Promise<DepartmentWithHierarchy | null> {
        return prisma.department.findUnique({
            where: { id },
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
        });
    },

    /**
     * Find or create department by name
     * Useful for Keycloak sync where department might not exist
     */
    async findOrCreateByName(
        name: string,
        shortName?: string
    ): Promise<DepartmentEntity> {
        const existing = await this.findByName(name);

        if (existing) {
            return existing;
        }

        return prisma.department.create({
            data: {
                name,
                shortName,
            },
        });
    },

    /**
     * Create a new department
     */
    async create(data: CreateDepartmentInput): Promise<DepartmentEntity> {
        return prisma.department.create({
            data,
        });
    },

    /**
     * Update an existing department
     */
    async update(id: string, data: UpdateDepartmentInput): Promise<DepartmentEntity> {
        return prisma.department.update({
            where: { id },
            data,
        });
    },

    /**
     * Delete a department
     */
    async delete(id: string): Promise<DepartmentEntity> {
        return prisma.department.delete({
            where: { id },
        });
    },

    /**
     * Find all active departments
     */
    async findAllActive(): Promise<DepartmentEntity[]> {
        return prisma.department.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
    },

    /**
     * Find root departments (no parent)
     */
    async findRootDepartments(): Promise<DepartmentWithHierarchy[]> {
        return prisma.department.findMany({
            where: {
                parentId: null,
                isActive: true,
            },
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
    },

    /**
     * Find departments with pagination and filters
     */
    async findMany(
        criteria: DepartmentFilterCriteria
    ): Promise<PaginatedResult<DepartmentEntity>> {
        const { search, isActive, parentId, page = 1, pageSize = 20 } = criteria;

        const where = {
            ...(isActive !== undefined && { isActive }),
            ...(parentId !== undefined && { parentId }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" as const } },
                    { shortName: { contains: search, mode: "insensitive" as const } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            prisma.department.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { name: "asc" },
            }),
            prisma.department.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);

        return {
            data,
            pagination: {
                page,
                pageSize,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
            },
        };
    },

    /**
     * Count users in department
     */
    async countUsers(departmentId: string): Promise<number> {
        return prisma.user.count({
            where: { departmentId },
        });
    },

    /**
     * Check if department has children
     */
    async hasChildren(departmentId: string): Promise<boolean> {
        const count = await prisma.department.count({
            where: { parentId: departmentId },
        });
        return count > 0;
    },
};
