import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/shared/types";
import type {
  EligibleOffSiteWorkOption,
  ExpenseClaimDocumentEntity,
  ExpenseClaimDocumentFilterCriteria,
  ExpenseClaimDocumentWithRelations,
  PreparedRevision,
} from "./types";
import { CLAIM_DAILY_RATE } from "./validation";

const claimantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  departmentId: true,
} as const;

const creatorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
} as const;

const revisionInclude = {
  offSiteWorks: { orderBy: { createdAt: "asc" as const } },
  workDates: {
    orderBy: { workDate: "asc" as const },
    include: { weSafeCodes: { orderBy: { createdAt: "asc" as const } } },
  },
  leaderVerifications: { orderBy: { createdAt: "asc" as const } },
} as const;

const claimInclude = {
  claimant: { select: claimantSelect },
  createdBy: { select: creatorSelect },
  revisions: {
    orderBy: { revisionNo: "desc" as const },
    take: 1,
    include: revisionInclude,
  },
  monthlyRequestItems: {
    where: { removedAt: null },
    select: { monthlyRequestCollectionId: true },
    take: 1,
  },
} as const;

type RawClaim = Awaited<ReturnType<typeof findRawClaim>>;
type TransactionClient = Prisma.TransactionClient;

export class ActiveClaimExistsError extends Error {
  constructor() {
    super("An active claim already exists for this user and month");
    this.name = "ActiveClaimExistsError";
  }
}

export class ClaimStateConflictError extends Error {
  constructor(message = "Expense claim state changed") {
    super(message);
    this.name = "ClaimStateConflictError";
  }
}

async function findRawClaim(id: string, includeCancelled = false) {
  return prisma.expenseClaim.findFirst({
    where: { id, ...(includeCancelled ? {} : { cancelledAt: null }) },
    include: claimInclude,
  });
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mapClaim(row: NonNullable<RawClaim>): ExpenseClaimDocumentWithRelations {
  const revision = row.revisions[0];
  if (!revision) {
    throw new Error(`Expense claim ${row.id} has no revision`);
  }

  const offSiteBySnapshotId = new Map(
    revision.offSiteWorks.map((item) => [item.id, item.offSiteWorkId]),
  );
  const revisionView = {
    id: revision.id,
    revisionNo: revision.revisionNo,
    status: revision.status,
    claimantPositionAtSubmission: revision.positionShortSnapshot,
    totalDays: revision.totalDays,
    totalAmount: Number(revision.totalAmount),
    ratePerDay: Number(revision.ratePerDay),
    remark: revision.remark,
    submittedAt: revision.submittedAt,
    supersededAt: revision.supersededAt,
    offSiteWorks: revision.offSiteWorks.map((item) => ({
      id: item.id,
      offSiteWorkId: item.offSiteWorkId,
      innerRefDocumentId: item.innerRefDocumentIdSnapshot,
      startDate: item.startDateSnapshot,
      endDate: item.endDateSnapshot,
      objective: item.objectiveSnapshot,
      location: item.locationSnapshot,
      leaderUserId: item.leaderUserIdSnapshot,
      leaderEmpId: item.leaderEmpIdSnapshot,
      leaderFirstName: item.leaderFirstNameSnapshot,
      leaderLastName: item.leaderLastNameSnapshot,
      leaderPosition: item.leaderPositionSnapshot,
      leaderEmail: item.leaderEmailSnapshot,
    })),
    workDates: revision.workDates.map((item) => ({
      id: item.id,
      date: isoDate(item.workDate),
      offSiteWorkId:
        revision.offSiteWorks.find((osw) => osw.id === item.revisionOffSiteWorkId)
          ?.offSiteWorkId ?? "",
      dayType: item.dayType,
      holidayType: item.holidayType,
      holidayName: item.holidayName,
      holidaySource: item.holidaySource,
      requiresWeSafe: item.requiresWeSafe,
      dailyRate: Number(item.dailyRate),
      weSafeCodes: item.weSafeCodes.map((entry) => entry.code),
    })),
  };

  return {
    id: row.id,
    expenseMonth: row.expenseMonth,
    userId: row.userId,
    createdById: row.createdById,
    status: row.status,
    currentRevisionNo: row.currentRevisionNo,
    collectedAt: row.collectedAt,
    completedAt: row.completedAt,
    rejectedAt: row.rejectedAt,
    rejectionReason: row.rejectionReason,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    currentRevision: revisionView,
    claimantPositionAtSubmission: revision.positionShortSnapshot,
    countDates: revision.totalDays,
    amount: Number(revision.totalAmount),
    remark: revision.remark,
    monthlyRequestCollectionId:
      row.monthlyRequestItems[0]?.monthlyRequestCollectionId ?? null,
    claimant: row.claimant,
    createdBy: row.createdBy,
    expenseClaimOffSiteWorks: revision.offSiteWorks.map((item) => ({
      offSiteWorkId: item.offSiteWorkId,
      offSiteWork: {
        id: item.offSiteWorkId,
        innerRefDocumentId: item.innerRefDocumentIdSnapshot,
        startDate: item.startDateSnapshot,
        endDate: item.endDateSnapshot,
        location: item.locationSnapshot,
        objective: item.objectiveSnapshot,
        leaderUserId: item.leaderUserIdSnapshot,
        leaderEmpId: item.leaderEmpIdSnapshot,
        leaderFirstName: item.leaderFirstNameSnapshot,
        leaderLastName: item.leaderLastNameSnapshot,
        leaderPosition: item.leaderPositionSnapshot,
        leaderEmail: item.leaderEmailSnapshot,
      },
    })),
    leaderVerifications: revision.leaderVerifications.map((item) => ({
      id: item.id,
      revisionNo: revision.revisionNo,
      offSiteWorkId: offSiteBySnapshotId.get(item.revisionOffSiteWorkId) ?? "",
      leaderUserId: item.leaderUserId,
      leaderEmail: item.leaderEmailSnapshot,
      expiresAt: item.expiresAt,
      confirmedAt: item.confirmedAt,
      status: item.status,
    })),
  };
}

async function replaceDraftRevisionContent(
  tx: TransactionClient,
  revisionId: string,
  prepared: PreparedRevision,
): Promise<void> {
  await tx.expenseClaimWorkDate.deleteMany({ where: { revisionId } });
  await tx.expenseClaimRevisionOffSiteWork.deleteMany({ where: { revisionId } });

  const snapshotIds = new Map<string, string>();
  for (const osw of prepared.offSiteWorks) {
    const snapshot = await tx.expenseClaimRevisionOffSiteWork.create({
      data: {
        revisionId,
        offSiteWorkId: osw.id,
        innerRefDocumentIdSnapshot: osw.innerRefDocumentId,
        startDateSnapshot: osw.startDate,
        endDateSnapshot: osw.endDate,
        objectiveSnapshot: osw.objective,
        locationSnapshot: osw.location,
        leaderUserIdSnapshot: osw.leaderUserId,
        leaderEmpIdSnapshot: osw.leaderEmpId,
        leaderFirstNameSnapshot: osw.leaderFirstName,
        leaderLastNameSnapshot: osw.leaderLastName,
        leaderPositionSnapshot: osw.leaderPosition,
        leaderEmailSnapshot: osw.leaderEmail,
      },
    });
    snapshotIds.set(osw.id, snapshot.id);
  }

  for (const workDate of prepared.workDates) {
    const revisionOffSiteWorkId = snapshotIds.get(workDate.offSiteWorkId);
    if (!revisionOffSiteWorkId) {
      throw new Error(`Missing off-site snapshot for ${workDate.offSiteWorkId}`);
    }
    await tx.expenseClaimWorkDate.create({
      data: {
        revisionId,
        revisionOffSiteWorkId,
        workDate: workDate.date,
        dayType: workDate.dayType,
        holidayType: workDate.holidayType,
        holidayName: workDate.holidayName,
        holidaySource: workDate.holidaySource,
        requiresWeSafe: workDate.requiresWeSafe,
        dailyRate: CLAIM_DAILY_RATE,
        weSafeCodes: {
          create: workDate.weSafeCodes.map((code) => ({ code })),
        },
      },
    });
  }

  await tx.expenseClaimRevision.update({
    where: { id: revisionId },
    data: {
      employeeIdSnapshot: prepared.claimant.employeeId,
      firstNameSnapshot: prepared.claimant.firstName,
      lastNameSnapshot: prepared.claimant.lastName,
      positionSnapshot: prepared.claimant.position,
      positionShortSnapshot: prepared.claimant.positionShort,
      positionLevelSnapshot: prepared.claimant.positionLevel,
      departmentIdSnapshot: prepared.claimant.departmentId,
      departmentNameSnapshot: prepared.claimant.departmentName,
      departmentShortSnapshot: prepared.claimant.departmentShort,
      ratePerDay: CLAIM_DAILY_RATE,
      totalDays: prepared.totalDays,
      totalAmount: prepared.totalAmount,
      remark: prepared.remark,
      materialHash: prepared.materialHash,
    },
  });
}

function sameNullable(a: string | null, b: string | null): boolean {
  return (a ?? null) === (b ?? null);
}

async function lockAndValidateOffSiteWorks(
  tx: TransactionClient,
  prepared: PreparedRevision,
  claimantId: string,
): Promise<void> {
  const ids = prepared.offSiteWorks.map((item) => item.id);
  const lockedAt = new Date();
  const locked = await tx.offSiteWork.updateMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      replacements: { none: { deletedAt: null } },
    },
    data: { lockedAt },
  });
  if (locked.count !== ids.length) {
    throw new ClaimStateConflictError("Off-site work changed or was replaced");
  }
  const rows = await tx.offSiteWork.findMany({
    where: { id: { in: ids } },
    include: {
      participants: {
        where: { userId: claimantId },
        select: { userId: true },
      },
    },
  });
  const rowById = new Map(rows.map((item) => [item.id, item]));
  for (const snapshot of prepared.offSiteWorks) {
    const row = rowById.get(snapshot.id);
    if (
      !row ||
      row.participants.length !== 1 ||
      row.startDate.getTime() !== snapshot.startDate.getTime() ||
      row.endDate.getTime() !== snapshot.endDate.getTime() ||
      !sameNullable(row.innerRefDocumentId, snapshot.innerRefDocumentId) ||
      !sameNullable(row.objective, snapshot.objective) ||
      !sameNullable(row.location, snapshot.location) ||
      !sameNullable(row.leaderUserId, snapshot.leaderUserId) ||
      !sameNullable(row.leaderEmpId, snapshot.leaderEmpId) ||
      !sameNullable(row.leaderFirstName, snapshot.leaderFirstName) ||
      !sameNullable(row.leaderLastName, snapshot.leaderLastName) ||
      !sameNullable(row.leaderPosition, snapshot.leaderPosition) ||
      !sameNullable(row.leaderEmail, snapshot.leaderEmail)
    ) {
      throw new ClaimStateConflictError("Off-site work changed before submit");
    }
  }
}

async function mappedClaim(id: string): Promise<ExpenseClaimDocumentEntity> {
  const row = await findRawClaim(id);
  if (!row) throw new ClaimStateConflictError("Expense claim disappeared");
  return mapClaim(row);
}

export const expenseClaimDocumentRepository = {
  async findWithRelations(
    id: string,
    includeCancelled = false,
  ): Promise<ExpenseClaimDocumentWithRelations | null> {
    const row = await findRawClaim(id, includeCancelled);
    return row ? mapClaim(row) : null;
  },

  async findById(
    id: string,
    includeCancelled = false,
  ): Promise<ExpenseClaimDocumentEntity | null> {
    const row = await findRawClaim(id, includeCancelled);
    return row ? mapClaim(row) : null;
  },

  findClaimantProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        position: true,
        positionShort: true,
        positionLevel: true,
        departmentId: true,
        department: { select: { name: true, shortName: true } },
      },
    });
  },

  async findActiveForUserMonth(userId: string, month: Date) {
    return prisma.expenseClaim.findFirst({
      where: { userId, expenseMonth: month, cancelledAt: null },
      select: { id: true, status: true },
    });
  },

  async findEligibleOffSiteWorksForUser(
    userId: string,
    month: Date,
  ): Promise<EligibleOffSiteWorkOption[]> {
    const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
    const rows = await prisma.offSiteWork.findMany({
      where: {
        deletedAt: null,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
        participants: { some: { userId } },
        replacements: { none: { deletedAt: null } },
      },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      supersedesId: row.supersedesId,
      innerRefDocumentId: row.innerRefDocumentId,
      startDate: row.startDate,
      endDate: row.endDate,
      location: row.location,
      objective: row.objective,
      hasLeader: Boolean(row.leaderUserId || row.leaderEmail),
      leaderFirstName: row.leaderFirstName,
      leaderLastName: row.leaderLastName,
      leaderEmail: row.leaderEmail,
    }));
  },

  findOffSiteWorksForParticipant(userId: string, ids: string[]) {
    return prisma.offSiteWork.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        participants: { some: { userId } },
        replacements: { none: { deletedAt: null } },
      },
    });
  },

  async createDraft(
    month: Date,
    userId: string,
    actorId: string,
    prepared: PreparedRevision,
  ): Promise<ExpenseClaimDocumentEntity> {
    let claimId: string;
    try {
      claimId = await prisma.$transaction(
        async (tx) => {
          const active = await tx.expenseClaim.findFirst({
            where: { userId, expenseMonth: month, cancelledAt: null },
            select: { id: true },
          });
          if (active) throw new ActiveClaimExistsError();
          const claim = await tx.expenseClaim.create({
            data: {
              expenseMonth: month,
              userId,
              createdById: actorId,
              status: "DRAFT",
              currentRevisionNo: 1,
              revisions: {
                create: {
                  revisionNo: 1,
                  status: "DRAFT",
                  employeeIdSnapshot: prepared.claimant.employeeId,
                  firstNameSnapshot: prepared.claimant.firstName,
                  lastNameSnapshot: prepared.claimant.lastName,
                  positionSnapshot: prepared.claimant.position,
                  positionShortSnapshot: prepared.claimant.positionShort,
                  positionLevelSnapshot: prepared.claimant.positionLevel,
                  departmentIdSnapshot: prepared.claimant.departmentId,
                  departmentNameSnapshot: prepared.claimant.departmentName,
                  departmentShortSnapshot: prepared.claimant.departmentShort,
                  ratePerDay: CLAIM_DAILY_RATE,
                  totalDays: 0,
                  totalAmount: 0,
                  remark: prepared.remark,
                },
              },
            },
            select: { id: true },
          });
          const revision = await tx.expenseClaimRevision.findUniqueOrThrow({
            where: {
              expenseClaimId_revisionNo: {
                expenseClaimId: claim.id,
                revisionNo: 1,
              },
            },
            select: { id: true },
          });
          await replaceDraftRevisionContent(tx, revision.id, prepared);
          return claim.id;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (cause) {
      if (
        cause instanceof ActiveClaimExistsError ||
        (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "P2034")
      ) {
        throw new ActiveClaimExistsError();
      }
      throw cause;
    }
    return mappedClaim(claimId);
  },

  async updateDraftRevision(
    claimId: string,
    revisionId: string,
    prepared: PreparedRevision,
  ): Promise<ExpenseClaimDocumentEntity> {
    await prisma.$transaction(async (tx) => {
      const current = await tx.expenseClaim.findUnique({
        where: { id: claimId },
        select: { status: true, revisions: { where: { id: revisionId }, select: { status: true } } },
      });
      if (current?.status !== "DRAFT" || current.revisions[0]?.status !== "DRAFT") {
        throw new ClaimStateConflictError();
      }
      await replaceDraftRevisionContent(tx, revisionId, prepared);
    });
    return mappedClaim(claimId);
  },

  async startCorrectionRevision(
    claimId: string,
    oldRevisionId: string,
    nextRevisionNo: number,
    prepared: PreparedRevision,
  ): Promise<ExpenseClaimDocumentEntity> {
    await prisma.$transaction(async (tx) => {
      const current = await tx.expenseClaim.findUnique({
        where: { id: claimId },
        select: { status: true, currentRevisionNo: true },
      });
      if (
        !current ||
        current.currentRevisionNo !== nextRevisionNo - 1 ||
        current.status === "COLLECTED" ||
        current.status === "COMPLETED" ||
        current.status === "CANCELLED"
      ) {
        throw new ClaimStateConflictError();
      }
      await tx.expenseClaimRevision.update({
        where: { id: oldRevisionId },
        data: { status: "SUPERSEDED", supersededAt: new Date() },
      });
      await tx.leaderVerification.updateMany({
        where: { claimRevisionId: oldRevisionId },
        data: { status: "SUPERSEDED", supersededAt: new Date() },
      });
      const revision = await tx.expenseClaimRevision.create({
        data: {
          expenseClaimId: claimId,
          revisionNo: nextRevisionNo,
          status: "DRAFT",
          employeeIdSnapshot: prepared.claimant.employeeId,
          firstNameSnapshot: prepared.claimant.firstName,
          lastNameSnapshot: prepared.claimant.lastName,
          positionSnapshot: prepared.claimant.position,
          positionShortSnapshot: prepared.claimant.positionShort,
          positionLevelSnapshot: prepared.claimant.positionLevel,
          departmentIdSnapshot: prepared.claimant.departmentId,
          departmentNameSnapshot: prepared.claimant.departmentName,
          departmentShortSnapshot: prepared.claimant.departmentShort,
          ratePerDay: CLAIM_DAILY_RATE,
          totalDays: 0,
          totalAmount: 0,
          remark: prepared.remark,
        },
      });
      await tx.expenseClaim.update({
        where: { id: claimId },
        data: {
          status: "DRAFT",
          currentRevisionNo: nextRevisionNo,
          rejectedAt: null,
          rejectedById: null,
          rejectionReason: null,
        },
      });
      await replaceDraftRevisionContent(tx, revision.id, prepared);
    });
    return mappedClaim(claimId);
  },

  async submitDraftAtomic<T>(
    claimId: string,
    revisionId: string,
    prepared: PreparedRevision,
    createVerifications: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(
      async (tx) => {
        const current = await tx.expenseClaim.findUnique({
          where: { id: claimId },
          select: {
            status: true,
            userId: true,
            currentRevisionNo: true,
            revisions: {
              where: { id: revisionId },
              select: { revisionNo: true, status: true },
            },
          },
        });
        const revision = current?.revisions[0];
        if (
          current?.status !== "DRAFT" ||
          revision?.status !== "DRAFT" ||
          revision.revisionNo !== current.currentRevisionNo
        ) {
          throw new ClaimStateConflictError();
        }

        await lockAndValidateOffSiteWorks(tx, prepared, current.userId);
        await replaceDraftRevisionContent(tx, revisionId, prepared);
        const result = await createVerifications(tx);
        const submittedAt = new Date();
        await tx.expenseClaimRevision.update({
          where: { id: revisionId },
          data: { status: "SUBMITTED", submittedAt },
        });
        await tx.expenseClaim.update({
          where: { id: claimId },
          data: { status: "PENDING_LEADER_CONFIRMATION" },
        });
        return result;
      },
      { isolationLevel: "Serializable" },
    );
  },

  async cancelAtomic(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.findUnique({
        where: { id },
        select: {
          status: true,
          currentRevisionNo: true,
          revisions: {
            orderBy: { revisionNo: "desc" },
            take: 1,
            select: { id: true, revisionNo: true },
          },
        },
      });
      if (!claim) throw new ClaimStateConflictError("Expense claim not found");
      if (claim.status === "COLLECTED" || claim.status === "COMPLETED") {
        throw new ClaimStateConflictError("Expense claim is immutable");
      }
      if (claim.status === "CANCELLED") return;
      const currentRevision = claim.revisions[0];
      if (currentRevision?.revisionNo !== claim.currentRevisionNo) {
        throw new ClaimStateConflictError();
      }
      const cancelledAt = new Date();
      if (currentRevision) {
        await tx.leaderVerification.updateMany({
          where: { claimRevisionId: currentRevision.id, supersededAt: null },
          data: { status: "SUPERSEDED", supersededAt: cancelledAt },
        });
      }
      await tx.expenseClaim.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt },
      });
    });
  },

  async findMany(
    criteria: ExpenseClaimDocumentFilterCriteria,
  ): Promise<PaginatedResult<ExpenseClaimDocumentWithRelations>> {
    const page = Math.max(1, criteria.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, criteria.pageSize ?? 20));
    const where: Prisma.ExpenseClaimWhereInput = {};
    if (!criteria.includeCancelled) where.cancelledAt = null;
    if (criteria.userId) where.userId = criteria.userId;
    if (criteria.createdById) where.createdById = criteria.createdById;
    if (criteria.status) where.status = criteria.status;
    if (criteria.expenseMonthFrom || criteria.expenseMonthTo) {
      where.expenseMonth = {
        ...(criteria.expenseMonthFrom
          ? { gte: new Date(criteria.expenseMonthFrom) }
          : {}),
        ...(criteria.expenseMonthTo ? { lte: new Date(criteria.expenseMonthTo) } : {}),
      };
    }
    if (criteria.search?.trim()) {
      const search = criteria.search.trim();
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        {
          claimant: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { employeeId: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.expenseClaim.findMany({
        where,
        include: claimInclude,
        orderBy: [{ expenseMonth: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expenseClaim.count({ where }),
    ]);
    const totalPages = Math.ceil(total / pageSize);
    return {
      data: rows.map((row) => mapClaim(row)),
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
};
