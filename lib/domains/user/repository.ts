/**
 * User Domain - Repository Layer
 * 
 * Data access layer for User entity
 * Handles all database operations through Prisma
 * 
 * @module lib/domains/user/repository
 */

import { prisma } from "@/lib/db";
import { UserStatus } from "@/lib/shared/types";
import type {
    UserEntity,
    UserWithDepartment,
    CreateUserInput,
    UpdateUserInput,
    UserFilterCriteria,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

/**
 * User Repository - Data access functions
 */
export const userRepository = {
    /**
     * Find user by ID
     */
    async findById(id: string): Promise<UserEntity | null> {
        return prisma.user.findUnique({
            where: { id },
        });
    },

    /**
     * Find user by Keycloak ID
     */
    async findByKeycloakId(keycloakId: string): Promise<UserEntity | null> {
        return prisma.user.findUnique({
            where: { keycloakId },
        });
    },

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<UserEntity | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    },

    /**
     * Find user with department details
     */
    async findWithDepartment(id: string): Promise<UserWithDepartment | null> {
        return prisma.user.findUnique({
            where: { id },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                        shortName: true,
                    },
                },
            },
        });
    },

    /**
     * Find user by Keycloak ID with department
     */
    async findByKeycloakIdWithDepartment(
        keycloakId: string
    ): Promise<UserWithDepartment | null> {
        return prisma.user.findUnique({
            where: { keycloakId },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                        shortName: true,
                    },
                },
            },
        });
    },

    /**
     * Create a new user
     */
    async create(data: CreateUserInput): Promise<UserEntity> {
        return prisma.user.create({
            data: {
                keycloakId: data.keycloakId,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                peaEmail: data.peaEmail,
                phoneNumber: data.phoneNumber,
                position: data.position,
                positionShort: data.positionShort,
                positionLevel: data.positionLevel,
                departmentId: data.departmentId,
                status: UserStatus.ACTIVE,
            },
        });
    },

    /**
     * Update an existing user
     */
    async update(id: string, data: UpdateUserInput): Promise<UserEntity> {
        return prisma.user.update({
            where: { id },
            data,
        });
    },

    /**
     * Update user by Keycloak ID
     */
    async updateByKeycloakId(
        keycloakId: string,
        data: UpdateUserInput
    ): Promise<UserEntity> {
        return prisma.user.update({
            where: { keycloakId },
            data,
        });
    },

    /**
     * Update last login timestamp
     */
    async updateLastLogin(id: string): Promise<UserEntity> {
        return prisma.user.update({
            where: { id },
            data: { lastLoginAt: new Date() },
        });
    },

    /**
     * Delete a user
     */
    async delete(id: string): Promise<UserEntity> {
        return prisma.user.delete({
            where: { id },
        });
    },

    /**
     * Find users with pagination and filters
     */
    async findMany(
        criteria: UserFilterCriteria
    ): Promise<PaginatedResult<UserEntity>> {
        const { search, status, departmentId, page = 1, pageSize = 20 } = criteria;

        const where = {
            ...(status && { status }),
            ...(departmentId && { departmentId }),
            ...(search && {
                OR: [
                    { firstName: { contains: search, mode: "insensitive" as const } },
                    { lastName: { contains: search, mode: "insensitive" as const } },
                    { email: { contains: search, mode: "insensitive" as const } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: "desc" },
            }),
            prisma.user.count({ where }),
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
     * Check if user exists by Keycloak ID
     */
    async existsByKeycloakId(keycloakId: string): Promise<boolean> {
        const count = await prisma.user.count({
            where: { keycloakId },
        });
        return count > 0;
    },

    /**
     * Count users by status
     */
    async countByStatus(status: UserStatus): Promise<number> {
        return prisma.user.count({
            where: { status },
        });
    },
};
