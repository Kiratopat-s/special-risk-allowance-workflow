/**
 * Action Log Domain - Entity Types
 * 
 * Pure domain types for UserActionLog entity
 * 
 * @module lib/domains/action-log/types
 */

import type { ActionType } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";

// JSON type compatible with Prisma
type JsonValue = Prisma.JsonValue;

/**
 * Core UserActionLog entity interface
 */
export interface ActionLogEntity {
    id: string;
    userId: string;
    actionType: ActionType;
    actionDescription: string | null;
    targetUserId: string | null;
    targetDepartmentId: string | null;
    targetEntityType: string | null;
    targetEntityId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    requestPath: string | null;
    requestMethod: string | null;
    metadata: JsonValue;
    previousData: JsonValue;
    newData: JsonValue;
    isSuccess: boolean;
    errorMessage: string | null;
    createdAt: Date;
}

/**
 * Action log with related entity details
 */
export interface ActionLogWithDetails extends ActionLogEntity {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    };
    targetUser?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null;
    targetDepartment?: {
        id: string;
        name: string;
    } | null;
}

/**
 * Data required to create an action log
 */
export interface CreateActionLogInput {
    userId: string;
    actionType: ActionType;
    actionDescription?: string;
    targetUserId?: string;
    targetDepartmentId?: string;
    targetEntityType?: string;
    targetEntityId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
    requestMethod?: string;
    metadata?: JsonValue;
    previousData?: JsonValue;
    newData?: JsonValue;
    isSuccess?: boolean;
    errorMessage?: string;
}

/**
 * Filter criteria for querying action logs
 */
export interface ActionLogFilterCriteria {
    userId?: string;
    actionType?: ActionType;
    targetUserId?: string;
    targetDepartmentId?: string;
    isSuccess?: boolean;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
}

/**
 * Action log summary for dashboard/reports
 */
export interface ActionLogSummary {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    actionsByType: Record<ActionType, number>;
    recentActivity: ActionLogWithDetails[];
}
