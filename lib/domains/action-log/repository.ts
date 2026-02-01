/**
 * Action Log Domain - Repository Layer
 * 
 * Data access layer for UserActionLog entity
 * 
 * @module lib/domains/action-log/repository
 */

import { prisma } from "@/lib/db";
import type { ActionType } from "@/lib/shared/types";
import type {
    ActionLogEntity,
    ActionLogWithDetails,
    CreateActionLogInput,
    ActionLogFilterCriteria,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

/**
 * Action Log Repository - Data access functions
 */
export const actionLogRepository = {
    /**
     * Find action log by ID
     */
    async findById(id: string): Promise<ActionLogEntity | null> {
        return prisma.userActionLog.findUnique({
            where: { id },
        });
    },

    /**
     * Find action log with details
     */
    async findWithDetails(id: string): Promise<ActionLogWithDetails | null> {
        return prisma.userActionLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                targetUser: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                targetDepartment: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        }) as Promise<ActionLogWithDetails | null>;
    },

    /**
     * Create a new action log entry
     */
    async create(data: CreateActionLogInput): Promise<ActionLogEntity> {
        return prisma.userActionLog.create({
            data: {
                userId: data.userId,
                actionType: data.actionType,
                actionDescription: data.actionDescription,
                targetUserId: data.targetUserId,
                targetDepartmentId: data.targetDepartmentId,
                targetEntityType: data.targetEntityType,
                targetEntityId: data.targetEntityId,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                requestPath: data.requestPath,
                requestMethod: data.requestMethod,
                metadata: data.metadata ?? undefined,
                previousData: data.previousData ?? undefined,
                newData: data.newData ?? undefined,
                isSuccess: data.isSuccess ?? true,
                errorMessage: data.errorMessage,
            },
        });
    },

    /**
     * Find action logs by user
     */
    async findByUserId(
        userId: string,
        limit = 50
    ): Promise<ActionLogWithDetails[]> {
        return prisma.userActionLog.findMany({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                targetUser: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                targetDepartment: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        }) as Promise<ActionLogWithDetails[]>;
    },

    /**
     * Find action logs with pagination and filters
     */
    async findMany(
        criteria: ActionLogFilterCriteria
    ): Promise<PaginatedResult<ActionLogWithDetails>> {
        const {
            userId,
            actionType,
            targetUserId,
            targetDepartmentId,
            isSuccess,
            startDate,
            endDate,
            page = 1,
            pageSize = 20,
        } = criteria;

        const where = {
            ...(userId && { userId }),
            ...(actionType && { actionType }),
            ...(targetUserId && { targetUserId }),
            ...(targetDepartmentId && { targetDepartmentId }),
            ...(isSuccess !== undefined && { isSuccess }),
            ...(startDate || endDate
                ? {
                    createdAt: {
                        ...(startDate && { gte: startDate }),
                        ...(endDate && { lte: endDate }),
                    },
                }
                : {}),
        };

        const [data, total] = await Promise.all([
            prisma.userActionLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    targetUser: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    targetDepartment: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: "desc" },
            }),
            prisma.userActionLog.count({ where }),
        ]);

        const totalPages = Math.ceil(total / pageSize);

        return {
            data: data as ActionLogWithDetails[],
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
     * Get recent activity (global)
     */
    async getRecentActivity(limit = 10): Promise<ActionLogWithDetails[]> {
        return prisma.userActionLog.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                targetUser: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                targetDepartment: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        }) as Promise<ActionLogWithDetails[]>;
    },

    /**
     * Count actions by type
     */
    async countByType(): Promise<Record<string, number>> {
        const result = await prisma.userActionLog.groupBy({
            by: ["actionType"],
            _count: {
                id: true,
            },
        });

        return result.reduce(
            (acc, item) => ({
                ...acc,
                [item.actionType]: item._count.id,
            }),
            {} as Record<string, number>
        );
    },

    /**
     * Count actions in date range
     */
    async countInDateRange(
        startDate: Date,
        endDate: Date,
        isSuccess?: boolean
    ): Promise<number> {
        return prisma.userActionLog.count({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                ...(isSuccess !== undefined && { isSuccess }),
            },
        });
    },

    /**
     * Delete old logs (for data retention)
     */
    async deleteOlderThan(date: Date): Promise<number> {
        const result = await prisma.userActionLog.deleteMany({
            where: {
                createdAt: {
                    lt: date,
                },
            },
        });
        return result.count;
    },

    /**
     * Get login history for user
     */
    async getLoginHistory(
        userId: string,
        limit = 10
    ): Promise<ActionLogEntity[]> {
        return prisma.userActionLog.findMany({
            where: {
                userId,
                actionType: {
                    in: ["LOGIN", "LOGOUT", "LOGIN_FAILED"],
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    },
};
