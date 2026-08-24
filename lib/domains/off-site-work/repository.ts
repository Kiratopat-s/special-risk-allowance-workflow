import { prisma } from "@/lib/db";
import { sanitizeStrings } from "@/lib/shared/sanitize";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/shared/types";
import type {
  CreateOffSiteWorkInput,
  ParticipantListItem,
  OffSiteWorkEntity,
  OffSiteWorkFilterCriteria,
  OffSiteWorkWithRelations,
  ResolvedParticipant,
  UpdateOffSiteWorkInput,
} from "./types";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  peaEmail: true,
  employeeId: true,
  position: true,
  positionShort: true,
  positionLevel: true,
  departmentId: true,
  department: { select: { name: true } },
} as const;

const relationInclude = {
  postedByUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeId: true,
    },
  },
  originalFile: {
    select: { id: true, fileName: true, fileType: true, fileSize: true },
  },
  leaderUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      position: true,
    },
  },
  participants: { orderBy: { createdAt: "asc" as const } },
} as const;

type RawWithRelations = Awaited<ReturnType<typeof findRawWithRelations>>;

async function findRawWithRelations(id: string) {
  return prisma.offSiteWork.findFirst({
    where: { id, deletedAt: null },
    include: relationInclude,
  });
}

function mapParticipants(
  rows: NonNullable<RawWithRelations>["participants"],
): ParticipantListItem[] {
  return rows.map((item) => ({
    userId: item.userId,
    employeeId: item.employeeIdSnapshot,
    firstName: item.firstNameSnapshot,
    lastName: item.lastNameSnapshot,
    position: item.positionSnapshot,
    positionShort: item.positionShortSnapshot,
    positionLevel: item.positionLevelSnapshot,
    departmentId: item.departmentIdSnapshot,
    departmentName: item.departmentNameSnapshot,
  }));
}

function mapResolvedParticipants(
  rows: NonNullable<RawWithRelations>["participants"],
): ResolvedParticipant[] {
  return rows.map((item) => ({
    userId: item.userId,
    employeeIdSnapshot: item.employeeIdSnapshot,
    firstNameSnapshot: item.firstNameSnapshot,
    lastNameSnapshot: item.lastNameSnapshot,
    positionSnapshot: item.positionSnapshot,
    positionShortSnapshot: item.positionShortSnapshot,
    positionLevelSnapshot: item.positionLevelSnapshot,
    departmentIdSnapshot: item.departmentIdSnapshot,
    departmentNameSnapshot: item.departmentNameSnapshot,
  }));
}

function mapEntity<T extends { participants: NonNullable<RawWithRelations>["participants"] }>(
  row: T,
): Omit<T, "participants"> & {
  participants: ResolvedParticipant[];
  participantList: ParticipantListItem[];
} {
  const { participants, ...rest } = row;
  return {
    ...rest,
    participants: mapResolvedParticipants(participants),
    participantList: mapParticipants(participants),
  };
}

function participantCreateData(participants: ResolvedParticipant[]) {
  return participants.map((participant) => ({
    userId: participant.userId,
    employeeIdSnapshot: participant.employeeIdSnapshot,
    firstNameSnapshot: participant.firstNameSnapshot,
    lastNameSnapshot: participant.lastNameSnapshot,
    positionSnapshot: participant.positionSnapshot,
    positionShortSnapshot: participant.positionShortSnapshot,
    positionLevelSnapshot: participant.positionLevelSnapshot,
    departmentIdSnapshot: participant.departmentIdSnapshot,
    departmentNameSnapshot: participant.departmentNameSnapshot,
  }));
}

export const offSiteWorkRepository = {
  async findAnyById(id: string) {
    return prisma.offSiteWork.findUnique({ where: { id } });
  },

  async findById(id: string): Promise<OffSiteWorkEntity | null> {
    const row = await prisma.offSiteWork.findFirst({
      where: { id, deletedAt: null },
      include: { participants: { orderBy: { createdAt: "asc" } } },
    });
    return row ? (mapEntity(row) as OffSiteWorkEntity) : null;
  },

  async findWithRelations(id: string): Promise<OffSiteWorkWithRelations | null> {
    const row = await findRawWithRelations(id);
    return row ? (mapEntity(row) as OffSiteWorkWithRelations) : null;
  },

  findUsersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      select: userSelect,
    });
  },

  async create(
    input: CreateOffSiteWorkInput,
    postedByUserId: string,
    participants: ResolvedParticipant[],
  ): Promise<{ record: OffSiteWorkEntity; invalidatedClaimIds: string[] }> {
    const data = sanitizeStrings(input);
    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.offSiteWork.findUnique({
        where: { id: data.id.trim() },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_OFF_SITE_WORK_ID");

      if (data.supersedesId) {
        const target = await tx.offSiteWork.findUnique({
          where: { id: data.supersedesId },
          select: {
            id: true,
            lockedAt: true,
            deletedAt: true,
            replacements: {
              where: { deletedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        });
        if (!target || target.deletedAt || !target.lockedAt) {
          throw new Error("INVALID_REPLACEMENT_TARGET");
        }
        if (target.replacements.length > 0) {
          throw new Error("REPLACEMENT_ALREADY_EXISTS");
        }
      }

      const created = await tx.offSiteWork.create({
        data: {
          id: data.id.trim(),
          innerRefDocumentId: data.innerRefDocumentId?.trim() || null,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          objective: data.objective?.trim() || null,
          location: data.location?.trim() || null,
          originalFileId: data.originalFileId || null,
          supersedesId: data.supersedesId || null,
          postedByUserId,
          leaderUserId: data.leaderUserId ?? null,
          leaderEmpId: data.leaderEmpId?.trim() || null,
          leaderFirstName: data.leaderFirstName?.trim() || null,
          leaderLastName: data.leaderLastName?.trim() || null,
          leaderPosition: data.leaderPosition?.trim() || null,
          leaderEmail: data.leaderEmail?.trim().toLowerCase() || null,
          participants: { create: participantCreateData(participants) },
        },
        include: { participants: { orderBy: { createdAt: "asc" } } },
      });

      let invalidatedClaimIds: string[] = [];
      if (data.supersedesId) {
        const affected = await tx.expenseClaimRevisionOffSiteWork.findMany({
          where: {
            offSiteWorkId: data.supersedesId,
            revision: {
              expenseClaim: {
                OR: [
                  {
                    status: {
                      in: [
                        "DRAFT",
                        "PENDING_LEADER_CONFIRMATION",
                        "READY_FOR_COLLECTION",
                        "REJECTED",
                      ],
                    },
                  },
                  {
                    status: "COLLECTED",
                    monthlyRequestItems: {
                      some: {
                        removedAt: null,
                        monthlyRequestCollection: { status: "DRAFT" },
                      },
                    },
                  },
                ],
              },
            },
          },
          select: {
            revisionId: true,
            revision: {
              select: {
                revisionNo: true,
                expenseClaim: { select: { id: true, currentRevisionNo: true } },
              },
            },
          },
        });
        const currentAffected = affected.filter(
          (item) =>
            item.revision.revisionNo ===
            item.revision.expenseClaim.currentRevisionNo,
        );
        const revisionIds = [...new Set(currentAffected.map((item) => item.revisionId))];
        invalidatedClaimIds = [
          ...new Set(
            currentAffected.map((item) => item.revision.expenseClaim.id),
          ),
        ];
        const supersededAt = new Date();
        const draftItems =
          invalidatedClaimIds.length > 0
            ? await tx.monthlyRequestCollectionItem.findMany({
                where: {
                  expenseClaimId: { in: invalidatedClaimIds },
                  removedAt: null,
                  monthlyRequestCollection: { status: "DRAFT" },
                },
                select: { id: true, monthlyRequestCollectionId: true },
              })
            : [];
        if (draftItems.length > 0) {
          const removed = await tx.monthlyRequestCollectionItem.updateMany({
            where: {
              id: { in: draftItems.map((item) => item.id) },
              removedAt: null,
              monthlyRequestCollection: { status: "DRAFT" },
            },
            data: {
              removedAt: supersededAt,
              removedById: postedByUserId,
              removalReason: `ใบนำตัว ${data.supersedesId} ถูกแทนที่ด้วย ${data.id.trim()}`,
            },
          });
          if (removed.count !== draftItems.length) {
            throw new Error("CLAIM_COLLECTION_STATE_CHANGED");
          }

          for (const monthlyRequestCollectionId of [
            ...new Set(
              draftItems.map((item) => item.monthlyRequestCollectionId),
            ),
          ]) {
            const activeItems = await tx.monthlyRequestCollectionItem.findMany({
              where: { monthlyRequestCollectionId, removedAt: null },
              select: { dayCountSnapshot: true, amountSnapshot: true },
            });
            if (
              activeItems.some(
                (item) =>
                  item.dayCountSnapshot === null || item.amountSnapshot === null,
              )
            ) {
              throw new Error("CLAIM_COLLECTION_STATE_CHANGED");
            }
            const totals = activeItems.reduce(
              (sum, item) => ({
                countDates: sum.countDates + Number(item.dayCountSnapshot),
                amount: sum.amount + Number(item.amountSnapshot),
              }),
              { countDates: 0, amount: 0 },
            );
            const recalculated = await tx.monthlyRequestCollection.updateMany({
              where: { id: monthlyRequestCollectionId, status: "DRAFT" },
              data: {
                claimCount: activeItems.length,
                countDates: totals.countDates,
                amount: totals.amount,
              },
            });
            if (recalculated.count !== 1) {
              throw new Error("CLAIM_COLLECTION_STATE_CHANGED");
            }
          }
        }
        if (revisionIds.length > 0) {
          await tx.expenseClaimRevision.updateMany({
            where: { id: { in: revisionIds } },
            data: { status: "SUPERSEDED", supersededAt },
          });
          await tx.leaderVerification.updateMany({
            where: { claimRevisionId: { in: revisionIds }, supersededAt: null },
            data: { status: "SUPERSEDED", supersededAt },
          });
        }
        if (invalidatedClaimIds.length > 0) {
          await tx.expenseClaim.updateMany({
            where: { id: { in: invalidatedClaimIds } },
            data: {
              status: "REJECTED",
              rejectedAt: supersededAt,
              rejectedById: postedByUserId,
              rejectionReason: `ใบนำตัว ${data.supersedesId} ถูกแทนที่ด้วย ${data.id.trim()}`,
              collectedAt: null,
            },
          });
        }
      }

      return { created, invalidatedClaimIds };
    }, { isolationLevel: "Serializable" });
    return {
      record: mapEntity(result.created) as OffSiteWorkEntity,
      invalidatedClaimIds: result.invalidatedClaimIds,
    };
  },

  async update(
    id: string,
    input: UpdateOffSiteWorkInput,
    participants?: ResolvedParticipant[],
  ): Promise<OffSiteWorkEntity> {
    const data = sanitizeStrings(input);
    const updateData: Record<string, unknown> = {};
    if (data.innerRefDocumentId !== undefined)
      updateData.innerRefDocumentId = data.innerRefDocumentId?.trim() || null;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.objective !== undefined) updateData.objective = data.objective?.trim() || null;
    if (data.location !== undefined) updateData.location = data.location?.trim() || null;
    if (data.originalFileId !== undefined) updateData.originalFileId = data.originalFileId || null;
    if (data.leaderUserId !== undefined) updateData.leaderUserId = data.leaderUserId;
    if (data.leaderEmpId !== undefined) updateData.leaderEmpId = data.leaderEmpId?.trim() || null;
    if (data.leaderFirstName !== undefined)
      updateData.leaderFirstName = data.leaderFirstName?.trim() || null;
    if (data.leaderLastName !== undefined)
      updateData.leaderLastName = data.leaderLastName?.trim() || null;
    if (data.leaderPosition !== undefined)
      updateData.leaderPosition = data.leaderPosition?.trim() || null;
    if (data.leaderEmail !== undefined)
      updateData.leaderEmail = data.leaderEmail?.trim().toLowerCase() || null;

    const row = await prisma.$transaction(async (tx) => {
      const changed = await tx.offSiteWork.updateMany({
        where: { id, deletedAt: null, lockedAt: null },
        data: updateData,
      });
      if (changed.count !== 1) throw new Error("OFF_SITE_WORK_LOCKED");
      if (participants) {
        await tx.offSiteWorkParticipant.deleteMany({ where: { offSiteWorkId: id } });
        if (participants.length > 0) {
          await tx.offSiteWorkParticipant.createMany({
            data: participantCreateData(participants).map((item) => ({
              ...item,
              offSiteWorkId: id,
            })),
          });
        }
      }
      return tx.offSiteWork.findUniqueOrThrow({
        where: { id },
        include: { participants: { orderBy: { createdAt: "asc" } } },
      });
    });
    return mapEntity(row) as OffSiteWorkEntity;
  },

  async softDelete(id: string): Promise<void> {
    const changed = await prisma.offSiteWork.updateMany({
      where: { id, deletedAt: null, lockedAt: null },
      data: { deletedAt: new Date() },
    });
    if (changed.count !== 1) throw new Error("OFF_SITE_WORK_LOCKED");
  },

  async restore(id: string): Promise<void> {
    await prisma.offSiteWork.update({ where: { id }, data: { deletedAt: null } });
  },

  async lockMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.offSiteWork.updateMany({
      where: { id: { in: ids }, lockedAt: null },
      data: { lockedAt: new Date() },
    });
  },

  async findMany(
    criteria: OffSiteWorkFilterCriteria,
  ): Promise<PaginatedResult<OffSiteWorkWithRelations>> {
    const page = Math.max(1, criteria.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, criteria.pageSize ?? 20));
    const where: Prisma.OffSiteWorkWhereInput = {};
    if (!criteria.includeDeleted) where.deletedAt = null;
    if (criteria.postedByUserId) where.postedByUserId = criteria.postedByUserId;
    if (criteria.participantUserId) {
      where.participants = { some: { userId: criteria.participantUserId } };
    }
    if (criteria.startDateFrom || criteria.startDateTo) {
      where.startDate = {
        ...(criteria.startDateFrom ? { gte: new Date(criteria.startDateFrom) } : {}),
        ...(criteria.startDateTo ? { lte: new Date(criteria.startDateTo) } : {}),
      };
    }
    if (criteria.search?.trim()) {
      const search = criteria.search.trim();
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { innerRefDocumentId: { contains: search, mode: "insensitive" } },
        { objective: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.offSiteWork.findMany({
        where,
        include: relationInclude,
        orderBy: [{ postedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.offSiteWork.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: rows.map((row) => mapEntity(row) as OffSiteWorkWithRelations),
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

  async hasRevisionSnapshots(id: string): Promise<boolean> {
    return (
      (await prisma.expenseClaimRevisionOffSiteWork.count({
        where: { offSiteWorkId: id },
      })) > 0
    );
  },
};
