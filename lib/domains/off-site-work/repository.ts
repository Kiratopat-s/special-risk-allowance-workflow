/**
 * OffSiteWork Domain - Repository Layer
 *
 * Data access layer for OffSiteWork entity
 *
 * @module lib/domains/off-site-work/repository
 */

import { prisma } from "@/lib/db";
import type {
  OffSiteWorkEntity,
  OffSiteWorkWithRelations,
  CreateOffSiteWorkInput,
  UpdateOffSiteWorkInput,
  OffSiteWorkFilterCriteria,
} from "./types";
import type { PaginatedResult } from "@/lib/shared/types";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  employeeId: true,
} as const;

const fileSelect = {
  id: true,
  fileName: true,
  fileType: true,
  fileSize: true,
} as const;

/**
 * OffSiteWork Repository - Data access functions
 */
export const offSiteWorkRepository = {
  /**
   * Find off-site work by ID (exclude soft-deleted)
   */
  async findById(id: string): Promise<OffSiteWorkEntity | null> {
    return prisma.offSiteWork.findFirst({
      where: { id, deletedAt: null },
    });
  },

  /**
   * Find off-site work by ID with relations
   */
  async findWithRelations(id: string): Promise<OffSiteWorkWithRelations | null> {
    return prisma.offSiteWork.findFirst({
      where: { id, deletedAt: null },
      include: {
        postedByUser: { select: userSelect },
        originalFile: { select: fileSelect },
      },
    });
  },

  /**
   * Create a new off-site work record
   */
  async create(
    data: CreateOffSiteWorkInput,
    postedByUserId: string
  ): Promise<OffSiteWorkEntity> {
    return prisma.offSiteWork.create({
      data: {
        id: data.id,
        innerRefDocumentId: data.innerRefDocumentId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        objective: data.objective,
        location: data.location,
        employeeList: data.employeeList ?? undefined,
        originalFileId: data.originalFileId,
        postedByUserId,
      },
    });
  },

  /**
   * Update an existing off-site work record
   */
  async update(
    id: string,
    data: UpdateOffSiteWorkInput
  ): Promise<OffSiteWorkEntity> {
    return prisma.offSiteWork.update({
      where: { id },
      data: {
        ...(data.innerRefDocumentId !== undefined && {
          innerRefDocumentId: data.innerRefDocumentId,
        }),
        ...(data.startDate !== undefined && {
          startDate: new Date(data.startDate),
        }),
        ...(data.endDate !== undefined && {
          endDate: new Date(data.endDate),
        }),
        ...(data.objective !== undefined && { objective: data.objective }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.employeeList !== undefined && {
          employeeList: data.employeeList ?? undefined,
        }),
        ...(data.originalFileId !== undefined && {
          originalFileId: data.originalFileId,
        }),
      },
    });
  },

  /**
   * Soft-delete an off-site work record
   */
  async softDelete(id: string): Promise<OffSiteWorkEntity> {
    return prisma.offSiteWork.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  /**
   * Restore a soft-deleted off-site work record
   */
  async restore(id: string): Promise<OffSiteWorkEntity> {
    return prisma.offSiteWork.update({
      where: { id },
      data: { deletedAt: null },
    });
  },

  /**
   * Find many off-site work records with pagination and filters
   */
  async findMany(
    criteria: OffSiteWorkFilterCriteria
  ): Promise<PaginatedResult<OffSiteWorkWithRelations>> {
    const {
      search,
      postedByUserId,
      startDateFrom,
      startDateTo,
      includeDeleted = false,
      page = 1,
      pageSize = 20,
    } = criteria;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (postedByUserId) {
      where.postedByUserId = postedByUserId;
    }

    if (startDateFrom || startDateTo) {
      where.startDate = {};
      if (startDateFrom) where.startDate.gte = new Date(startDateFrom);
      if (startDateTo) where.startDate.lte = new Date(startDateTo);
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { innerRefDocumentId: { contains: search, mode: "insensitive" } },
        { objective: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.offSiteWork.findMany({
        where,
        include: {
          postedByUser: { select: userSelect },
          originalFile: { select: fileSelect },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { postedAt: "desc" },
      }),
      prisma.offSiteWork.count({ where }),
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
   * Find off-site work records by user
   */
  async findByUser(
    userId: string,
    limit = 50
  ): Promise<OffSiteWorkWithRelations[]> {
    return prisma.offSiteWork.findMany({
      where: { postedByUserId: userId, deletedAt: null },
      include: {
        postedByUser: { select: userSelect },
        originalFile: { select: fileSelect },
      },
      orderBy: { postedAt: "desc" },
      take: limit,
    });
  },

  /**
   * Check if off-site work has linked expense claims
   */
  async hasExpenseClaims(id: string): Promise<boolean> {
    const count = await prisma.expenseClaimOffSiteWork.count({
      where: { offSiteWorkId: id },
    });
    return count > 0;
  },
};
