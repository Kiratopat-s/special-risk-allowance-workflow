/**
 * OffSiteWork Domain - Service Layer
 *
 * Business logic layer for OffSiteWork operations
 *
 * @module lib/domains/off-site-work/service
 */

import { offSiteWorkRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { ActionType } from "@/lib/shared/types";
import { success, error, type Result } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  OffSiteWorkEntity,
  OffSiteWorkWithRelations,
  CreateOffSiteWorkInput,
  UpdateOffSiteWorkInput,
  OffSiteWorkFilterCriteria,
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
 * OffSiteWork Service - Business logic functions
 */
export const offSiteWorkService = {
  /**
   * Get off-site work by ID
   */
  async getById(id: string): Promise<Result<OffSiteWorkWithRelations>> {
    const record = await offSiteWorkRepository.findWithRelations(id);

    if (!record) {
      return error("Off-site work record not found", "OFF_SITE_WORK_NOT_FOUND");
    }

    return success(record);
  },

  /**
   * Create a new off-site work record
   */
  async create(
    data: CreateOffSiteWorkInput,
    actorId: string,
    context?: RequestContext
  ): Promise<Result<OffSiteWorkEntity>> {
    // Validate date range
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate < startDate) {
      return error(
        "End date must be after or equal to start date",
        "INVALID_DATE_RANGE"
      );
    }

    // Validate ID is provided
    if (!data.id || data.id.trim().length === 0) {
      return error("Document ID is required", "MISSING_ID");
    }

    // Check for duplicate ID
    const existing = await offSiteWorkRepository.findById(data.id);
    if (existing) {
      return error(
        "Off-site work with this ID already exists",
        "DUPLICATE_ID"
      );
    }

    const record = await offSiteWorkRepository.create(data, actorId);

    // Log creation
    await actionLogService.log({
      userId: actorId,
      actionType: ActionType.OTHER,
      actionDescription: `Off-site work "${record.id}" created`,
      targetEntityType: "OffSiteWork",
      targetEntityId: record.id,
      newData: {
        id: record.id,
        startDate: record.startDate.toISOString(),
        endDate: record.endDate.toISOString(),
        objective: record.objective,
        location: record.location,
      } as unknown as JsonValue,
      ...context,
    });

    return success(record, "Off-site work created successfully");
  },

  /**
   * Update an off-site work record
   */
  async update(
    id: string,
    data: UpdateOffSiteWorkInput,
    actorId: string,
    context?: RequestContext
  ): Promise<Result<OffSiteWorkEntity>> {
    const existing = await offSiteWorkRepository.findById(id);

    if (!existing) {
      return error("Off-site work record not found", "OFF_SITE_WORK_NOT_FOUND");
    }

    // Validate date range if both dates provided
    const startDate = data.startDate
      ? new Date(data.startDate)
      : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;

    if (endDate < startDate) {
      return error(
        "End date must be after or equal to start date",
        "INVALID_DATE_RANGE"
      );
    }

    const previousData = {
      innerRefDocumentId: existing.innerRefDocumentId,
      startDate: existing.startDate.toISOString(),
      endDate: existing.endDate.toISOString(),
      objective: existing.objective,
      location: existing.location,
    };

    const record = await offSiteWorkRepository.update(id, data);

    // Log update
    await actionLogService.log({
      userId: actorId,
      actionType: ActionType.OTHER,
      actionDescription: `Off-site work "${id}" updated`,
      targetEntityType: "OffSiteWork",
      targetEntityId: id,
      previousData: previousData as unknown as JsonValue,
      newData: data as unknown as JsonValue,
      ...context,
    });

    return success(record, "Off-site work updated successfully");
  },

  /**
   * Soft-delete an off-site work record
   */
  async delete(
    id: string,
    actorId: string,
    context?: RequestContext
  ): Promise<Result<void>> {
    const existing = await offSiteWorkRepository.findById(id);

    if (!existing) {
      return error("Off-site work record not found", "OFF_SITE_WORK_NOT_FOUND");
    }

    // Check for linked expense claims
    const hasExpenseClaims = await offSiteWorkRepository.hasExpenseClaims(id);
    if (hasExpenseClaims) {
      return error(
        "Cannot delete off-site work with linked expense claims",
        "HAS_EXPENSE_CLAIMS"
      );
    }

    await offSiteWorkRepository.softDelete(id);

    // Log soft-delete
    await actionLogService.log({
      userId: actorId,
      actionType: ActionType.OTHER,
      actionDescription: `Off-site work "${id}" deleted`,
      targetEntityType: "OffSiteWork",
      targetEntityId: id,
      previousData: {
        id: existing.id,
        objective: existing.objective,
        location: existing.location,
      } as unknown as JsonValue,
      ...context,
    });

    return success(undefined, "Off-site work deleted successfully");
  },

  /**
   * List off-site work records with filters
   */
  async list(
    criteria: OffSiteWorkFilterCriteria
  ): Promise<Result<PaginatedResult<OffSiteWorkWithRelations>>> {
    const result = await offSiteWorkRepository.findMany(criteria);
    return success(result);
  },

  /**
   * Get off-site work records by user
   */
  async getByUser(
    userId: string,
    limit?: number
  ): Promise<Result<OffSiteWorkWithRelations[]>> {
    const records = await offSiteWorkRepository.findByUser(userId, limit);
    return success(records);
  },
};
