/**
 * Action Log Domain - Service Layer
 * 
 * Business logic layer for action logging operations
 * This is the primary API for audit trail functionality
 * 
 * @module lib/domains/action-log/service
 */

import { actionLogRepository } from "./repository";
import { success, error, type Result } from "@/lib/shared/types";
import type { ActionType } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
    ActionLogEntity,
    ActionLogWithDetails,
    CreateActionLogInput,
    ActionLogFilterCriteria,
    ActionLogSummary,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

type JsonValue = Prisma.JsonValue;

/**
 * Action Log Service - Business logic functions
 */
export const actionLogService = {
    /**
     * Log an action (primary method for creating audit entries)
     * This method is designed to be fire-and-forget - it won't throw errors
     */
    async log(input: CreateActionLogInput): Promise<ActionLogEntity | null> {
        try {
            return await actionLogRepository.create(input);
        } catch (err) {
            // Log to console but don't throw - audit logging shouldn't break main flow
            console.error("Failed to create action log:", err);
            return null;
        }
    },

    /**
     * Get action log by ID
     */
    async getById(id: string): Promise<Result<ActionLogWithDetails>> {
        const log = await actionLogRepository.findWithDetails(id);

        if (!log) {
            return error("Action log not found", "LOG_NOT_FOUND");
        }

        return success(log);
    },

    /**
     * Get user's action history
     */
    async getUserHistory(
        userId: string,
        limit = 50
    ): Promise<Result<ActionLogWithDetails[]>> {
        const logs = await actionLogRepository.findByUserId(userId, limit);
        return success(logs);
    },

    /**
     * Get user's login history
     */
    async getLoginHistory(
        userId: string,
        limit = 10
    ): Promise<Result<ActionLogEntity[]>> {
        const logs = await actionLogRepository.getLoginHistory(userId, limit);
        return success(logs);
    },

    /**
     * Search action logs with filters
     */
    async search(
        criteria: ActionLogFilterCriteria
    ): Promise<Result<PaginatedResult<ActionLogWithDetails>>> {
        const result = await actionLogRepository.findMany(criteria);
        return success(result);
    },

    /**
     * Get recent activity (for dashboard)
     */
    async getRecentActivity(limit = 10): Promise<Result<ActionLogWithDetails[]>> {
        const logs = await actionLogRepository.getRecentActivity(limit);
        return success(logs);
    },

    /**
     * Get action log summary (for dashboard/reports)
     */
    async getSummary(
        startDate?: Date,
        endDate?: Date
    ): Promise<Result<ActionLogSummary>> {
        const effectiveStartDate = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const effectiveEndDate = endDate ?? new Date();

        const [totalActions, successfulActions, failedActions, actionsByType, recentActivity] =
            await Promise.all([
                actionLogRepository.countInDateRange(effectiveStartDate, effectiveEndDate),
                actionLogRepository.countInDateRange(effectiveStartDate, effectiveEndDate, true),
                actionLogRepository.countInDateRange(effectiveStartDate, effectiveEndDate, false),
                actionLogRepository.countByType(),
                actionLogRepository.getRecentActivity(10),
            ]);

        return success({
            totalActions,
            successfulActions,
            failedActions,
            actionsByType: actionsByType as Record<ActionType, number>,
            recentActivity,
        });
    },

    /**
     * Log authentication event helper
     */
    async logAuth(
        userId: string,
        actionType: "LOGIN" | "LOGOUT" | "LOGIN_FAILED" | "SESSION_REFRESH",
        context?: {
            ipAddress?: string;
            userAgent?: string;
            errorMessage?: string;
        }
    ): Promise<ActionLogEntity | null> {
        return this.log({
            userId,
            actionType: actionType as ActionType,
            actionDescription: this.getAuthDescription(actionType),
            isSuccess: actionType !== "LOGIN_FAILED",
            errorMessage: context?.errorMessage,
            ipAddress: context?.ipAddress,
            userAgent: context?.userAgent,
        });
    },

    /**
     * Log CRUD operation helper
     */
    async logCrud(
        userId: string,
        operation: "CREATE" | "UPDATE" | "DELETE",
        entityType: string,
        entityId: string,
        options?: {
            previousData?: JsonValue;
            newData?: JsonValue;
            description?: string;
            context?: {
                ipAddress?: string;
                userAgent?: string;
                requestPath?: string;
                requestMethod?: string;
            };
        }
    ): Promise<ActionLogEntity | null> {
        const actionTypeMap: Record<string, ActionType> = {
            CREATE_USER: "USER_CREATED" as ActionType,
            UPDATE_USER: "USER_UPDATED" as ActionType,
            DELETE_USER: "USER_DELETED" as ActionType,
            CREATE_DEPARTMENT: "DEPARTMENT_CREATED" as ActionType,
            UPDATE_DEPARTMENT: "DEPARTMENT_UPDATED" as ActionType,
            DELETE_DEPARTMENT: "DEPARTMENT_DELETED" as ActionType,
        };

        const actionTypeKey = `${operation}_${entityType.toUpperCase()}`;
        const actionType = actionTypeMap[actionTypeKey] ?? ("OTHER" as ActionType);

        return this.log({
            userId,
            actionType,
            actionDescription:
                options?.description ??
                `${operation} ${entityType} ${entityId}`,
            targetEntityType: entityType,
            targetEntityId: entityId,
            previousData: options?.previousData,
            newData: options?.newData,
            ...options?.context,
        });
    },

    /**
     * Cleanup old logs (for data retention policy)
     */
    async cleanup(retentionDays = 365): Promise<Result<number>> {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const deletedCount = await actionLogRepository.deleteOlderThan(cutoffDate);
        return success(deletedCount, `Deleted ${deletedCount} old action logs`);
    },

    /**
     * Helper to get authentication action description
     */
    getAuthDescription(actionType: string): string {
        const descriptions: Record<string, string> = {
            LOGIN: "User logged in successfully",
            LOGOUT: "User logged out",
            LOGIN_FAILED: "Login attempt failed",
            SESSION_REFRESH: "Session token refreshed",
        };
        return descriptions[actionType] ?? "Authentication event";
    },
};
