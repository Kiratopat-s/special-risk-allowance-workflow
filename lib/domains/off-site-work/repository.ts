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
import { sanitizeStrings } from "@/lib/shared/sanitize";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  employeeId: true,
} as const;

const leaderUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  position: true,
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
    const result = await prisma.offSiteWork.findFirst({
      where: { id, deletedAt: null },
    });
    return result as OffSiteWorkEntity | null;
  },

  /**
   * Find off-site work by ID with relations
   */
  async findWithRelations(id: string): Promise<OffSiteWorkWithRelations | null> {
    const result = await prisma.offSiteWork.findFirst({
      where: { id, deletedAt: null },
      include: {
        postedByUser: { select: userSelect },
        originalFile: { select: fileSelect },
        leaderUser: { select: leaderUserSelect },
      },
    });
    return result as OffSiteWorkWithRelations | null;
  },

  /**
   * Create a new off-site work record
   */
  async create(
    data: CreateOffSiteWorkInput,
    postedByUserId: string
  ): Promise<OffSiteWorkEntity> {
    // Strip null bytes (0x00) from all string fields — PostgreSQL rejects them
    data = sanitizeStrings(data);

    // Prisma's JSON field type is strict; we cast through Object to satisfy type requirements
    const createData = {
      id: data.id,
      innerRefDocumentId: data.innerRefDocumentId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      objective: data.objective,
      location: data.location,
      // EmployeeListItem[] is JSON-serializable; cast through Object for Prisma compatibility
      employeeList: (data.employeeList || null) as unknown,
      originalFileId: data.originalFileId,
      postedByUserId,
      leaderUserId: data.leaderUserId ?? null,
      leaderEmpId: data.leaderEmpId ?? null,
      leaderFirstName: data.leaderFirstName ?? null,
      leaderLastName: data.leaderLastName ?? null,
      leaderPosition: data.leaderPosition ?? null,
      leaderEmail: data.leaderEmail ?? null,
    };

    return prisma.offSiteWork.create({
      data: createData as Parameters<typeof prisma.offSiteWork.create>[0]["data"],
    }) as Promise<OffSiteWorkEntity>;
  },

  /**
   * Update an existing off-site work record
   */
  async update(
    id: string,
    data: UpdateOffSiteWorkInput
  ): Promise<OffSiteWorkEntity> {
    // Strip null bytes (0x00) from all string fields — PostgreSQL rejects them
    data = sanitizeStrings(data);

    // Build update data object with proper typing
    const updateData: Record<string, unknown> = {};

    if (data.innerRefDocumentId !== undefined) {
      updateData.innerRefDocumentId = data.innerRefDocumentId;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate !== undefined) {
      updateData.endDate = new Date(data.endDate);
    }
    if (data.objective !== undefined) {
      updateData.objective = data.objective;
    }
    if (data.location !== undefined) {
      updateData.location = data.location;
    }
    if (data.employeeList !== undefined) {
      // EmployeeListItem[] is JSON-serializable; cast through unknown for Prisma compatibility
      updateData.employeeList = (data.employeeList || null) as unknown;
    }
    if (data.originalFileId !== undefined) {
      updateData.originalFileId = data.originalFileId;
    }
    if (data.leaderUserId !== undefined) {
      updateData.leaderUserId = data.leaderUserId;
    }
    if (data.leaderEmpId !== undefined) {
      updateData.leaderEmpId = data.leaderEmpId;
    }
    if (data.leaderFirstName !== undefined) {
      updateData.leaderFirstName = data.leaderFirstName;
    }
    if (data.leaderLastName !== undefined) {
      updateData.leaderLastName = data.leaderLastName;
    }
    if (data.leaderPosition !== undefined) {
      updateData.leaderPosition = data.leaderPosition;
    }
    if (data.leaderEmail !== undefined) {
      updateData.leaderEmail = data.leaderEmail;
    }

    return prisma.offSiteWork.update({
      where: { id },
      data: updateData,
    }) as Promise<OffSiteWorkEntity>;
  },

  /**
   * Soft-delete an off-site work record
   */
  async softDelete(id: string): Promise<OffSiteWorkEntity> {
    const result = await prisma.offSiteWork.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return result as OffSiteWorkEntity;
  },

  /**
   * Restore a soft-deleted off-site work record
   */
  async restore(id: string): Promise<OffSiteWorkEntity> {
    const result = await prisma.offSiteWork.update({
      where: { id },
      data: { deletedAt: null },
    });
    return result as OffSiteWorkEntity;
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
          leaderUser: { select: leaderUserSelect },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { postedAt: "desc" },
      }),
      prisma.offSiteWork.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: data as OffSiteWorkWithRelations[],
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
    const result = await prisma.offSiteWork.findMany({
      where: { postedByUserId: userId, deletedAt: null },
      include: {
        postedByUser: { select: userSelect },
        originalFile: { select: fileSelect },
      },
      orderBy: { postedAt: "desc" },
      take: limit,
    });
    return result as OffSiteWorkWithRelations[];
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
