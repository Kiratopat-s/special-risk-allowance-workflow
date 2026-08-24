/** Monthly Request Collection persistence and transactional snapshot operations. */

import { prisma } from "@/lib/db";
import {
  Prisma,
  type MonthlyRequestStatus,
} from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/shared/types";
import { createMonthlyRequestItemDates } from "./item-date-persistence";
import { validateMrcTransition, validatePaperApprovalDate } from "./policy";
import { computeMrcSnapshotHash, sortMrcSnapshotItems } from "./snapshot";
import type {
  CompleteMrcInput,
  CreateMrcInput,
  EligibleExpenseClaimForCollection,
  MrcDepartmentOption,
  MrcFilterCriteria,
  MonthlyRequestCollectionEntity,
  MonthlyRequestCollectionWithRelations,
  VoidMrcResult,
} from "./types";

const ACTIVE_MRC_STATUSES: MonthlyRequestStatus[] = [
  "DRAFT",
  "FINALIZED",
  "ALL_DONE",
];

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
} satisfies Prisma.UserSelect;

const collectionInclude = {
  department: { select: { id: true, name: true, shortName: true } },
  collector: { select: personSelect },
  finalizedBy: { select: personSelect },
  allDoneBy: { select: personSelect },
  cancelledBy: { select: personSelect },
  voidedBy: { select: personSelect },
  items: {
    include: {
      expenseClaim: { select: { status: true } },
      claimRevision: { select: { revisionNo: true } },
      dates: {
        orderBy: { workDate: "asc" },
        include: { weSafeCodes: { orderBy: { code: "asc" } } },
      },
    },
    orderBy: [{ rowNo: "asc" }, { addedAt: "asc" }],
  },
  replacementSources: {
    include: {
      voidedMrc: {
        select: {
          id: true,
          collectForMonth: true,
          batchNo: true,
          status: true,
          voidReason: true,
        },
      },
    },
  },
} satisfies Prisma.MonthlyRequestCollectionInclude;

const candidateInclude = {
  revisions: {
    where: { status: "SUBMITTED" },
    orderBy: { revisionNo: "desc" },
    take: 1,
    include: {
      offSiteWorks: {
        select: {
          offSiteWorkId: true,
          leaderVerification: { select: { status: true } },
        },
      },
      workDates: {
        orderBy: { workDate: "asc" },
        include: {
          weSafeCodes: { orderBy: { code: "asc" } },
          revisionOffSiteWork: {
            select: {
              offSiteWorkId: true,
              innerRefDocumentIdSnapshot: true,
            },
          },
        },
      },
    },
  },
  reviewFlags: {
    where: { status: "OPEN" },
    select: { id: true },
  },
  monthlyRequestItems: {
    where: {
      removedAt: null,
      monthlyRequestCollection: { status: { in: ACTIVE_MRC_STATUSES } },
    },
    select: {
      monthlyRequestCollectionId: true,
      monthlyRequestCollection: { select: { status: true } },
    },
  },
} satisfies Prisma.ExpenseClaimInclude;

type RawCollection = Prisma.MonthlyRequestCollectionGetPayload<{
  include: typeof collectionInclude;
}>;
type CandidateClaim = Prisma.ExpenseClaimGetPayload<{
  include: typeof candidateInclude;
}>;
type TransactionClient = Prisma.TransactionClient;

interface ClaimSnapshot {
  expenseClaimId: string;
  claimRevisionId: string;
  revisionNo: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  positionShort: string;
  positionLevel: string | null;
  departmentId: string;
  departmentName: string;
  departmentShort: string | null;
  dayCount: number;
  amount: number;
  remark: string | null;
  materialHash: string | null;
  dates: Array<{
    workDate: Date;
    offSiteWorkIdSnapshot: string;
    offSiteWorkRefSnapshot: string | null;
    dayType: CandidateClaim["revisions"][number]["workDates"][number]["dayType"];
    holidayType: CandidateClaim["revisions"][number]["workDates"][number]["holidayType"];
    holidayName: string | null;
    dailyRate: number;
    weSafeCodes: string[];
  }>;
}

export class MrcInvariantError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "MrcInvariantError";
  }
}

export function normalizeMrcMonth(value: Date | string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MrcInvariantError("Invalid collection month", "INVALID_MONTH");
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function sameMonth(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  );
}

function toEntity(
  row: Prisma.MonthlyRequestCollectionGetPayload<Record<string, never>>,
): MonthlyRequestCollectionEntity {
  return { ...row, amount: Number(row.amount) };
}

function itemBelongsToIssuedSnapshot(
  status: RawCollection["status"],
  item: RawCollection["items"][number],
): boolean {
  if (status === "DRAFT" || status === "FINALIZED" || status === "ALL_DONE") {
    return item.removedAt === null;
  }
  if (status === "CANCELLED") return item.removalReason === "MRC_CANCELLED";
  return item.removalReason === "MRC_VOIDED";
}

function toCollection(row: RawCollection): MonthlyRequestCollectionWithRelations {
  return {
    ...row,
    amount: Number(row.amount),
    items: row.items
      .filter((item) => itemBelongsToIssuedSnapshot(row.status, item))
      .map((item) => ({
        id: item.id,
        expenseClaimId: item.expenseClaimId,
        claimRevisionId: item.claimRevisionId,
        claimRevisionNo: item.claimRevision.revisionNo,
        addedById: item.addedById,
        addedAt: item.addedAt,
        removedAt: item.removedAt,
        removalReason: item.removalReason,
        rowNo: item.rowNo,
        employeeIdSnapshot: item.employeeIdSnapshot,
        firstNameSnapshot: item.firstNameSnapshot ?? "",
        lastNameSnapshot: item.lastNameSnapshot ?? "",
        positionShortSnapshot: item.positionShortSnapshot ?? "",
        positionLevelSnapshot: item.positionLevelSnapshot,
        departmentIdSnapshot: item.departmentIdSnapshot ?? row.departmentId,
        departmentNameSnapshot:
          item.departmentNameSnapshot ?? row.department.name,
        departmentShortSnapshot:
          item.departmentShortSnapshot ?? row.department.shortName,
        dayCountSnapshot: item.dayCountSnapshot ?? 0,
        amountSnapshot: Number(item.amountSnapshot ?? 0),
        remarkSnapshot: item.remarkSnapshot,
        claimStatus: item.expenseClaim.status,
        dates: item.dates.map((date) => ({
          id: date.id,
          workDate: date.workDate,
          offSiteWorkIdSnapshot: date.offSiteWorkIdSnapshot,
          offSiteWorkRefSnapshot: date.offSiteWorkRefSnapshot,
          dayType: date.dayType,
          holidayType: date.holidayType,
          holidayName: date.holidayName,
          dailyRate: Number(date.dailyRate),
          weSafeCodes: date.weSafeCodes.map((code) => ({
            id: code.id,
            code: code.code,
          })),
        })),
      })),
    replacementSources: row.replacementSources.map(({ voidedMrc }) => ({
      ...voidedMrc,
    })),
  };
}

function candidateToSnapshot(
  claim: CandidateClaim,
  expectedMonth: Date,
  departmentId: string,
  currentMrcId?: string,
): ClaimSnapshot {
  const belongsToCurrentDraft = Boolean(
    currentMrcId &&
      claim.monthlyRequestItems.some(
        (item) => item.monthlyRequestCollectionId === currentMrcId,
      ),
  );
  const hasValidClaimState = belongsToCurrentDraft
    ? claim.status === "COLLECTED"
    : claim.status === "READY_FOR_COLLECTION";
  if (!hasValidClaimState) {
    throw new MrcInvariantError(
      `Claim ${claim.id} is not in the expected collection state`,
      "CLAIM_STATE_MISMATCH",
    );
  }
  if (!sameMonth(claim.expenseMonth, expectedMonth)) {
    throw new MrcInvariantError(
      `Claim ${claim.id} belongs to another month`,
      "CLAIM_MONTH_MISMATCH",
    );
  }
  if (claim.reviewFlags.length > 0) {
    throw new MrcInvariantError(
      `Claim ${claim.id} still has an open review flag`,
      "CLAIM_HAS_OPEN_FLAG",
    );
  }
  const reservedElsewhere = claim.monthlyRequestItems.some(
    (item) => item.monthlyRequestCollectionId !== currentMrcId,
  );
  if (reservedElsewhere) {
    throw new MrcInvariantError(
      `Claim ${claim.id} is already reserved by another monthly request`,
      "CLAIM_ALREADY_RESERVED",
    );
  }

  const revision = claim.revisions[0];
  if (!revision || revision.revisionNo !== claim.currentRevisionNo) {
    throw new MrcInvariantError(
      `Claim ${claim.id} does not have a submitted current revision`,
      "CURRENT_REVISION_NOT_SUBMITTED",
    );
  }
  if (revision.departmentIdSnapshot !== departmentId) {
    throw new MrcInvariantError(
      `Claim ${claim.id} belongs to another department`,
      "CLAIM_DEPARTMENT_MISMATCH",
    );
  }
  if (revision.offSiteWorks.length === 0) {
    throw new MrcInvariantError(
      `Claim ${claim.id} does not reference an off-site work order`,
      "CLAIM_OFF_SITE_WORK_REQUIRED",
    );
  }
  const unconfirmedLeader = revision.offSiteWorks.find(
    (item) => item.leaderVerification?.status !== "CONFIRMED",
  );
  if (unconfirmedLeader) {
    throw new MrcInvariantError(
      `Claim ${claim.id} still has an unconfirmed team-leader verification`,
      "LEADER_CONFIRMATION_REQUIRED",
    );
  }

  const missingWeSafe = revision.workDates.find(
    (date) => date.requiresWeSafe && date.weSafeCodes.length === 0,
  );
  if (missingWeSafe) {
    throw new MrcInvariantError(
      `Claim ${claim.id} is missing a WeSafe code for ${missingWeSafe.workDate.toISOString().slice(0, 10)}`,
      "WE_SAFE_CODE_REQUIRED",
    );
  }
  if (revision.workDates.length === 0) {
    throw new MrcInvariantError(
      `Claim ${claim.id} has no work dates`,
      "CLAIM_WORK_DATE_REQUIRED",
    );
  }
  const calculatedAmount = revision.workDates.reduce(
    (sum, date) => sum + Number(date.dailyRate),
    0,
  );
  if (
    revision.totalDays !== revision.workDates.length ||
    Math.abs(Number(revision.totalAmount) - calculatedAmount) >= 0.005
  ) {
    throw new MrcInvariantError(
      `Claim ${claim.id} totals do not match its work-date snapshot`,
      "CLAIM_TOTAL_MISMATCH",
    );
  }

  return {
    expenseClaimId: claim.id,
    claimRevisionId: revision.id,
    revisionNo: revision.revisionNo,
    employeeId: revision.employeeIdSnapshot,
    firstName: revision.firstNameSnapshot,
    lastName: revision.lastNameSnapshot,
    positionShort: revision.positionShortSnapshot,
    positionLevel: revision.positionLevelSnapshot,
    departmentId: revision.departmentIdSnapshot,
    departmentName: revision.departmentNameSnapshot,
    departmentShort: revision.departmentShortSnapshot,
    dayCount: revision.totalDays,
    amount: Number(revision.totalAmount),
    remark: revision.remark,
    materialHash: revision.materialHash,
    dates: revision.workDates.map((date) => ({
      workDate: date.workDate,
      offSiteWorkIdSnapshot: date.revisionOffSiteWork.offSiteWorkId,
      offSiteWorkRefSnapshot:
        date.revisionOffSiteWork.innerRefDocumentIdSnapshot,
      dayType: date.dayType,
      holidayType: date.holidayType,
      holidayName: date.holidayName,
      dailyRate: Number(date.dailyRate),
      weSafeCodes: date.weSafeCodes.map((code) => code.code),
    })),
  };
}

async function loadSnapshots(
  tx: TransactionClient,
  expenseClaimIds: string[],
  month: Date,
  departmentId: string,
  currentMrcId?: string,
): Promise<ClaimSnapshot[]> {
  const ids = [...new Set(expenseClaimIds)];
  if (ids.length === 0) {
    throw new MrcInvariantError(
      "Please select at least one expense claim",
      "NO_CLAIMS_SELECTED",
    );
  }
  if (ids.length !== expenseClaimIds.length) {
    throw new MrcInvariantError(
      "The claim selection contains duplicates",
      "DUPLICATE_CLAIMS",
    );
  }

  const claims = await tx.expenseClaim.findMany({
    where: { id: { in: ids } },
    include: candidateInclude,
  });
  if (claims.length !== ids.length) {
    throw new MrcInvariantError(
      "One or more selected claims were not found",
      "CLAIM_NOT_FOUND",
    );
  }

  return sortMrcSnapshotItems(
    claims.map((claim) =>
      candidateToSnapshot(claim, month, departmentId, currentMrcId),
    ),
  );
}

async function applySnapshots(
  tx: TransactionClient,
  mrcId: string,
  snapshots: ClaimSnapshot[],
  actorId: string,
): Promise<void> {
  const existingItems = await tx.monthlyRequestCollectionItem.findMany({
    where: { monthlyRequestCollectionId: mrcId },
  });
  const selectedIds = new Set(snapshots.map((item) => item.expenseClaimId));
  const now = new Date();
  const removedClaimIds = existingItems
    .filter(
      (item) => item.removedAt === null && !selectedIds.has(item.expenseClaimId),
    )
    .map((item) => item.expenseClaimId);

  await tx.monthlyRequestCollectionItem.updateMany({
    where: {
      monthlyRequestCollectionId: mrcId,
      removedAt: null,
      expenseClaimId: { notIn: [...selectedIds] },
    },
    data: {
      removedAt: now,
      removedById: actorId,
      removalReason: "REMOVED_FROM_DRAFT",
    },
  });
  if (removedClaimIds.length > 0) {
    await tx.expenseClaim.updateMany({
      where: { id: { in: removedClaimIds }, status: "COLLECTED" },
      data: { status: "READY_FOR_COLLECTION", collectedAt: null },
    });
  }

  // Row numbers are unique only among active items. Clear them first so a
  // deterministic re-sort can swap/insert rows without transient conflicts.
  await tx.monthlyRequestCollectionItem.updateMany({
    where: {
      monthlyRequestCollectionId: mrcId,
      removedAt: null,
      expenseClaimId: { in: [...selectedIds] },
    },
    data: { rowNo: null },
  });

  await tx.expenseClaim.updateMany({
    where: {
      id: { in: [...selectedIds] },
      status: "READY_FOR_COLLECTION",
    },
    data: { status: "COLLECTED", collectedAt: now },
  });
  const reservedCount = await tx.expenseClaim.count({
    where: { id: { in: [...selectedIds] }, status: "COLLECTED" },
  });
  if (reservedCount !== snapshots.length) {
    throw new MrcInvariantError(
      "One or more claims changed while updating the draft",
      "CLAIM_STATE_CHANGED",
    );
  }

  for (const [index, snapshot] of snapshots.entries()) {
    const existing = existingItems.find(
      (item) => item.expenseClaimId === snapshot.expenseClaimId,
    );
    const data = {
      claimRevisionId: snapshot.claimRevisionId,
      removedAt: null,
      removedById: null,
      removalReason: null,
      rowNo: index + 1,
      employeeIdSnapshot: snapshot.employeeId,
      firstNameSnapshot: snapshot.firstName,
      lastNameSnapshot: snapshot.lastName,
      positionShortSnapshot: snapshot.positionShort,
      positionLevelSnapshot: snapshot.positionLevel,
      departmentIdSnapshot: snapshot.departmentId,
      departmentNameSnapshot: snapshot.departmentName,
      departmentShortSnapshot: snapshot.departmentShort,
      dayCountSnapshot: snapshot.dayCount,
      amountSnapshot: snapshot.amount,
      remarkSnapshot: snapshot.remark,
    } as const;

    if (existing) {
      await tx.monthlyRequestItemDate.deleteMany({
        where: { monthlyRequestItemId: existing.id },
      });
      await tx.monthlyRequestCollectionItem.update({
        where: { id: existing.id },
        data,
      });
      await createMonthlyRequestItemDates(tx, existing.id, snapshot.dates);
    } else {
      const monthlyRequestItem = await tx.monthlyRequestCollectionItem.create({
        data: {
          monthlyRequestCollectionId: mrcId,
          expenseClaimId: snapshot.expenseClaimId,
          addedById: actorId,
          ...data,
        },
      });
      await createMonthlyRequestItemDates(tx, monthlyRequestItem.id, snapshot.dates);
    }
  }

  await tx.monthlyRequestCollection.update({
    where: { id: mrcId },
    data: {
      claimCount: snapshots.length,
      countDates: snapshots.reduce((sum, item) => sum + item.dayCount, 0),
      amount: snapshots.reduce((sum, item) => sum + item.amount, 0),
    },
  });
}

async function mergeVoidedSourcesIntoDraft(
  tx: TransactionClient,
  sourceIds: string[],
  actorId: string,
): Promise<MonthlyRequestCollectionEntity> {
  const sources = await tx.monthlyRequestCollection.findMany({
    where: { id: { in: sourceIds } },
    include: {
      items: {
        where: { removalReason: "MRC_VOIDED" },
        select: { expenseClaimId: true },
      },
      replacementDrafts: {
        include: {
          replacementDraft: { select: { id: true, status: true } },
        },
      },
    },
  });
  if (sources.length !== sourceIds.length) {
    throw new MrcInvariantError(
      "One or more replacement sources were not found",
      "MRC_NOT_FOUND",
    );
  }
  if (sources.some((source) => source.status !== "VOIDED")) {
    throw new MrcInvariantError(
      "Replacement sources must all be voided",
      "MRC_NOT_VOIDED",
    );
  }
  const first = sources[0];
  if (
    sources.some(
      (source) =>
        source.departmentId !== first.departmentId ||
        !sameMonth(source.collectForMonth, first.collectForMonth),
    )
  ) {
    throw new MrcInvariantError(
      "Replacement sources must have the same month and department",
      "REPLACEMENT_SCOPE_MISMATCH",
    );
  }

  const linkedActiveReplacements = [
    ...new Map(
      sources
        .flatMap((source) => source.replacementDrafts)
        .map(({ replacementDraft }) => [replacementDraft.id, replacementDraft]),
    ).values(),
  ].filter((replacement) => ACTIVE_MRC_STATUSES.includes(replacement.status));
  if (
    linkedActiveReplacements.some(
      (replacement) => replacement.status !== "DRAFT",
    )
  ) {
    throw new MrcInvariantError(
      "A selected source already has a finalized replacement",
      "REPLACEMENT_ALREADY_FINALIZED",
    );
  }
  if (linkedActiveReplacements.length > 1) {
    throw new MrcInvariantError(
      "Selected sources belong to different replacement drafts",
      "REPLACEMENT_DRAFT_CONFLICT",
    );
  }

  let replacement = linkedActiveReplacements[0]
    ? await tx.monthlyRequestCollection.findUnique({
        where: { id: linkedActiveReplacements[0].id },
      })
    : await tx.monthlyRequestCollection.findFirst({
        where: {
          departmentId: first.departmentId,
          collectForMonth: first.collectForMonth,
          status: "DRAFT",
        },
        orderBy: { createdAt: "asc" },
      });
  if (!replacement) {
    replacement = await tx.monthlyRequestCollection.create({
      data: {
        departmentId: first.departmentId,
        collectorId: actorId,
        collectForMonth: first.collectForMonth,
        status: "DRAFT",
      },
    });
  }

  const existingItems = await tx.monthlyRequestCollectionItem.findMany({
    where: {
      monthlyRequestCollectionId: replacement.id,
      removedAt: null,
    },
    select: { expenseClaimId: true },
  });
  const claimIds = [
    ...new Set([
      ...existingItems.map((item) => item.expenseClaimId),
      ...sources.flatMap((source) =>
        source.items.map((item) => item.expenseClaimId),
      ),
    ]),
  ];
  const snapshots = await loadSnapshots(
    tx,
    claimIds,
    first.collectForMonth,
    first.departmentId,
    replacement.id,
  );
  await applySnapshots(tx, replacement.id, snapshots, actorId);
  for (const voidedMrcId of sourceIds) {
    await tx.mrcReplacementSource.upsert({
      where: {
        replacementDraftId_voidedMrcId: {
          replacementDraftId: replacement.id,
          voidedMrcId,
        },
      },
      create: { replacementDraftId: replacement.id, voidedMrcId },
      update: {},
    });
  }
  return toEntity(
    await tx.monthlyRequestCollection.findUniqueOrThrow({
      where: { id: replacement.id },
    }),
  );
}

export const monthlyRequestCollectionRepository = {
  async findById(id: string): Promise<MonthlyRequestCollectionEntity | null> {
    const row = await prisma.monthlyRequestCollection.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  },

  async findWithRelations(
    id: string,
  ): Promise<MonthlyRequestCollectionWithRelations | null> {
    const row = await prisma.monthlyRequestCollection.findUnique({
      where: { id },
      include: collectionInclude,
    });
    return row ? toCollection(row) : null;
  },

  async findMany(
    criteria: MrcFilterCriteria,
  ): Promise<PaginatedResult<MonthlyRequestCollectionWithRelations>> {
    const page = Math.max(1, criteria.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, criteria.pageSize ?? 20));
    const where: Prisma.MonthlyRequestCollectionWhereInput = {
      ...(criteria.status ? { status: criteria.status } : {}),
      ...(criteria.departmentId ? { departmentId: criteria.departmentId } : {}),
      ...(criteria.collectorId ? { collectorId: criteria.collectorId } : {}),
      ...(criteria.collectForMonthFrom || criteria.collectForMonthTo
        ? {
            collectForMonth: {
              ...(criteria.collectForMonthFrom
                ? { gte: normalizeMrcMonth(criteria.collectForMonthFrom) }
                : {}),
              ...(criteria.collectForMonthTo
                ? { lte: normalizeMrcMonth(criteria.collectForMonthTo) }
                : {}),
            },
          }
        : {}),
      ...(criteria.search
        ? {
            OR: [
              {
                department: {
                  name: { contains: criteria.search, mode: "insensitive" },
                },
              },
              {
                department: {
                  shortName: { contains: criteria.search, mode: "insensitive" },
                },
              },
              {
                collector: {
                  firstName: { contains: criteria.search, mode: "insensitive" },
                },
              },
              {
                collector: {
                  lastName: { contains: criteria.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.monthlyRequestCollection.findMany({
        where,
        include: collectionInclude,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { collectForMonth: "desc" },
          { batchNo: { sort: "desc", nulls: "first" } },
          { createdAt: "desc" },
        ],
      }),
      prisma.monthlyRequestCollection.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: rows.map(toCollection),
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

  async listDepartments(): Promise<MrcDepartmentOption[]> {
    return prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true },
      orderBy: { name: "asc" },
    });
  },

  async findEligibleExpenseClaimsForMonth(
    monthValue: Date | string,
    departmentId: string,
    existingMrcId?: string,
  ): Promise<EligibleExpenseClaimForCollection[]> {
    const month = normalizeMrcMonth(monthValue);
    const claims = await prisma.expenseClaim.findMany({
      where: {
        expenseMonth: month,
        status: { in: ["READY_FOR_COLLECTION", "COLLECTED"] },
      },
      include: candidateInclude,
      orderBy: { createdAt: "asc" },
    });

    return claims
      .filter((claim) => {
        const revision = claim.revisions[0];
        if (!revision || revision.revisionNo !== claim.currentRevisionNo) return false;
        if (revision.departmentIdSnapshot !== departmentId) return false;
        if (claim.reviewFlags.length > 0) return false;
        if (
          revision.offSiteWorks.length === 0 ||
          revision.offSiteWorks.some(
            (item) => item.leaderVerification?.status !== "CONFIRMED",
          ) ||
          revision.workDates.length === 0 ||
          revision.workDates.some(
            (date) => date.requiresWeSafe && date.weSafeCodes.length === 0,
          ) ||
          revision.totalDays !== revision.workDates.length ||
          Math.abs(
            Number(revision.totalAmount) -
              revision.workDates.reduce(
                (sum, date) => sum + Number(date.dailyRate),
                0,
              ),
          ) >= 0.005
        ) {
          return false;
        }
        const membershipMatches = claim.monthlyRequestItems.every(
          (item) => item.monthlyRequestCollectionId === existingMrcId,
        );
        const belongsToCurrent = claim.monthlyRequestItems.some(
          (item) => item.monthlyRequestCollectionId === existingMrcId,
        );
        return (
          membershipMatches &&
          ((belongsToCurrent && claim.status === "COLLECTED") ||
            (!belongsToCurrent && claim.status === "READY_FOR_COLLECTION"))
        );
      })
      .map((claim) => {
        const revision = claim.revisions[0]!;
        return {
          id: claim.id,
          expenseMonth: claim.expenseMonth,
          status: claim.status,
          currentRevisionNo: claim.currentRevisionNo,
          revisionId: revision.id,
          employeeId: revision.employeeIdSnapshot,
          firstName: revision.firstNameSnapshot,
          lastName: revision.lastNameSnapshot,
          positionShort: revision.positionShortSnapshot,
          positionLevel: revision.positionLevelSnapshot,
          departmentId: revision.departmentIdSnapshot,
          departmentName: revision.departmentNameSnapshot,
          departmentShort: revision.departmentShortSnapshot,
          dayCount: revision.totalDays,
          amount: Number(revision.totalAmount),
          remark: revision.remark,
          workDates: revision.workDates.map((date) => date.workDate),
          weSafeCodeCount: revision.workDates.reduce(
            (sum, date) => sum + date.weSafeCodes.length,
            0,
          ),
          isInCurrentDraft: claim.monthlyRequestItems.some(
            (item) => item.monthlyRequestCollectionId === existingMrcId,
          ),
        };
      })
      .sort((a, b) => a.employeeId.localeCompare(b.employeeId, "th"));
  },

  async createDraft(
    input: CreateMrcInput,
    actorId: string,
  ): Promise<MonthlyRequestCollectionEntity> {
    const month = normalizeMrcMonth(input.collectForMonth);
    return prisma.$transaction(
      async (tx) => {
        const department = await tx.department.findFirst({
          where: { id: input.departmentId, isActive: true },
          select: { id: true },
        });
        if (!department) {
          throw new MrcInvariantError(
            "Department not found or inactive",
            "DEPARTMENT_NOT_FOUND",
          );
        }
        let row = await tx.monthlyRequestCollection.findFirst({
          where: {
            departmentId: input.departmentId,
            collectForMonth: month,
            status: "DRAFT",
          },
          include: {
            items: {
              where: { removedAt: null },
              select: { expenseClaimId: true },
            },
          },
        });
        if (!row) {
          row = await tx.monthlyRequestCollection.create({
            data: {
              departmentId: input.departmentId,
              collectorId: actorId,
              collectForMonth: month,
              status: "DRAFT",
            },
            include: {
              items: {
                where: { removedAt: null },
                select: { expenseClaimId: true },
              },
            },
          });
        }
        const requestedIds = [
          ...new Set([
            ...row.items.map((item) => item.expenseClaimId),
            ...input.expenseClaimIds,
          ]),
        ];
        const snapshots = await loadSnapshots(
          tx,
          requestedIds,
          month,
          input.departmentId,
          row.id,
        );
        await applySnapshots(tx, row.id, snapshots, actorId);
        const updated = await tx.monthlyRequestCollection.findUniqueOrThrow({
          where: { id: row.id },
        });
        return toEntity(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async updateDraftItems(
    id: string,
    expenseClaimIds: string[],
    actorId: string,
  ): Promise<MonthlyRequestCollectionEntity> {
    return prisma.$transaction(
      async (tx) => {
        const mrc = await tx.monthlyRequestCollection.findUnique({ where: { id } });
        if (!mrc) throw new MrcInvariantError("MRC not found", "MRC_NOT_FOUND");
        if (mrc.status !== "DRAFT") {
          throw new MrcInvariantError(
            "A finalized monthly request is immutable",
            "MRC_NOT_DRAFT",
          );
        }
        const snapshots = await loadSnapshots(
          tx,
          expenseClaimIds,
          mrc.collectForMonth,
          mrc.departmentId,
          id,
        );
        await applySnapshots(tx, id, snapshots, actorId);
        return toEntity(
          await tx.monthlyRequestCollection.findUniqueOrThrow({ where: { id } }),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async finalizeDraft(
    id: string,
    actorId: string,
  ): Promise<MonthlyRequestCollectionEntity> {
    return prisma.$transaction(
      async (tx) => {
        const mrc = await tx.monthlyRequestCollection.findUnique({
          where: { id },
          include: {
            items: {
              where: { removedAt: null },
              select: { expenseClaimId: true },
            },
          },
        });
        if (!mrc) throw new MrcInvariantError("MRC not found", "MRC_NOT_FOUND");
        if (mrc.status === "FINALIZED") return toEntity(mrc);
        if (mrc.status !== "DRAFT") {
          throw new MrcInvariantError(
            "Only a draft can be finalized",
            "MRC_NOT_DRAFT",
          );
        }

        const snapshots = await loadSnapshots(
          tx,
          mrc.items.map((item) => item.expenseClaimId),
          mrc.collectForMonth,
          mrc.departmentId,
          id,
        );
        await applySnapshots(tx, id, snapshots, actorId);

        const transition = validateMrcTransition(mrc.status, "FINALIZED");
        if (!transition.valid) {
          throw new MrcInvariantError(transition.message, transition.code);
        }
        let batchNo = mrc.batchNo;
        if (batchNo === null) {
          const maxBatch = await tx.monthlyRequestCollection.aggregate({
            where: {
              departmentId: mrc.departmentId,
              collectForMonth: mrc.collectForMonth,
              batchNo: { not: null },
            },
            _max: { batchNo: true },
          });
          batchNo = (maxBatch._max.batchNo ?? 0) + 1;
        }
        const finalizedAt = new Date();

        const collectedCount = await tx.expenseClaim.count({
          where: {
            id: { in: snapshots.map((item) => item.expenseClaimId) },
            status: "COLLECTED",
          },
        });
        if (collectedCount !== snapshots.length) {
          throw new MrcInvariantError(
            "One or more claims changed while finalizing",
            "CLAIM_STATE_CHANGED",
          );
        }

        const updated = await tx.monthlyRequestCollection.update({
          where: { id },
          data: {
            status: "FINALIZED",
            batchNo,
            snapshotVersion: 1,
            snapshotHash: computeMrcSnapshotHash(
              {
                departmentId: mrc.departmentId,
                collectForMonth: mrc.collectForMonth,
                batchNo,
                snapshotVersion: 1,
              },
              snapshots,
            ),
            finalizedAt,
            finalizedById: actorId,
          },
        });
        return toEntity(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async complete(
    id: string,
    input: CompleteMrcInput,
    actorId: string,
  ): Promise<MonthlyRequestCollectionEntity> {
    return prisma.$transaction(
      async (tx) => {
        const mrc = await tx.monthlyRequestCollection.findUnique({
          where: { id },
          include: {
            items: {
              where: { removedAt: null },
              select: { expenseClaimId: true },
            },
          },
        });
        if (!mrc) throw new MrcInvariantError("MRC not found", "MRC_NOT_FOUND");
        if (mrc.status === "ALL_DONE") return toEntity(mrc);
        if (mrc.status !== "FINALIZED") {
          throw new MrcInvariantError(
            "Only a finalized monthly request can be completed",
            "MRC_NOT_FINALIZED",
          );
        }
        const transition = validateMrcTransition(mrc.status, "ALL_DONE");
        if (!transition.valid) {
          throw new MrcInvariantError(transition.message, transition.code);
        }
        const approvalDate = validatePaperApprovalDate(input.paperApprovedAt, {
          finalizedAt: mrc.finalizedAt,
        });
        if (!approvalDate.valid) {
          throw new MrcInvariantError(approvalDate.message, approvalDate.code);
        }
        const now = new Date();
        const claimUpdate = await tx.expenseClaim.updateMany({
          where: {
            id: { in: mrc.items.map((item) => item.expenseClaimId) },
            status: "COLLECTED",
          },
          data: { status: "COMPLETED", completedAt: now },
        });
        if (claimUpdate.count !== mrc.items.length) {
          throw new MrcInvariantError(
            "One or more claims changed while recording paper approval",
            "CLAIM_STATE_CHANGED",
          );
        }
        return toEntity(
          await tx.monthlyRequestCollection.update({
            where: { id },
            data: {
              status: "ALL_DONE",
              paperApprovedAt: approvalDate.value,
              allDoneNote: input.note?.trim() || null,
              allDoneAt: now,
              allDoneById: actorId,
            },
          }),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async cancelDraft(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<MonthlyRequestCollectionEntity> {
    return prisma.$transaction(async (tx) => {
      const mrc = await tx.monthlyRequestCollection.findUnique({ where: { id } });
      if (!mrc) throw new MrcInvariantError("MRC not found", "MRC_NOT_FOUND");
      if (mrc.status === "CANCELLED") return toEntity(mrc);
      if (mrc.status !== "DRAFT") {
        throw new MrcInvariantError(
          "Only a draft can be cancelled",
          "MRC_NOT_DRAFT",
        );
      }
      const transition = validateMrcTransition(mrc.status, "CANCELLED");
      if (!transition.valid) {
        throw new MrcInvariantError(transition.message, transition.code);
      }
      const now = new Date();
      const activeItems = await tx.monthlyRequestCollectionItem.findMany({
        where: { monthlyRequestCollectionId: id, removedAt: null },
        select: { expenseClaimId: true },
      });
      await tx.expenseClaim.updateMany({
        where: {
          id: { in: activeItems.map((item) => item.expenseClaimId) },
          status: "COLLECTED",
        },
        data: { status: "READY_FOR_COLLECTION", collectedAt: null },
      });
      await tx.monthlyRequestCollectionItem.updateMany({
        where: { monthlyRequestCollectionId: id, removedAt: null },
        data: {
          removedAt: now,
          removedById: actorId,
          removalReason: "MRC_CANCELLED",
        },
      });
      return toEntity(
        await tx.monthlyRequestCollection.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            cancelledById: actorId,
            cancelReason: reason,
          },
        }),
      );
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async voidFinalized(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<VoidMrcResult> {
    return prisma.$transaction(
      async (tx) => {
        const mrc = await tx.monthlyRequestCollection.findUnique({
          where: { id },
          include: {
            items: {
              where: { removedAt: null },
              select: { expenseClaimId: true },
            },
          },
        });
        if (!mrc) throw new MrcInvariantError("MRC not found", "MRC_NOT_FOUND");
        if (mrc.status === "VOIDED") {
          return {
            voided: toEntity(mrc),
            replacementDraft: await mergeVoidedSourcesIntoDraft(
              tx,
              [id],
              actorId,
            ),
          };
        }
        if (mrc.status !== "FINALIZED" && mrc.status !== "ALL_DONE") {
          throw new MrcInvariantError(
            "Only a finalized or completed monthly request can be voided",
            "MRC_NOT_VOIDABLE",
          );
        }
        const transition = validateMrcTransition(mrc.status, "VOIDED");
        if (!transition.valid) {
          throw new MrcInvariantError(transition.message, transition.code);
        }
        const now = new Date();
        const claimIds = mrc.items.map((item) => item.expenseClaimId);
        const released = await tx.expenseClaim.updateMany({
          where: {
            id: { in: claimIds },
            status: mrc.status === "ALL_DONE" ? "COMPLETED" : "COLLECTED",
          },
          data: {
            status: "READY_FOR_COLLECTION",
            collectedAt: null,
            completedAt: null,
          },
        });
        if (released.count !== claimIds.length) {
          throw new MrcInvariantError(
            "One or more claims changed while voiding the monthly request",
            "CLAIM_STATE_CHANGED",
          );
        }
        await tx.monthlyRequestCollectionItem.updateMany({
          where: { monthlyRequestCollectionId: id, removedAt: null },
          data: {
            removedAt: now,
            removedById: actorId,
            removalReason: "MRC_VOIDED",
          },
        });
        const voided = toEntity(
          await tx.monthlyRequestCollection.update({
            where: { id },
            data: {
              status: "VOIDED",
              voidedAt: now,
              voidedById: actorId,
              voidReason: reason,
            },
          }),
        );
        const replacementDraft = await mergeVoidedSourcesIntoDraft(
          tx,
          [id],
          actorId,
        );
        return { voided, replacementDraft };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async createReplacementDraft(
    voidedMrcIds: string[],
    actorId: string,
  ): Promise<MonthlyRequestCollectionEntity> {
    const sourceIds = [...new Set(voidedMrcIds)];
    if (sourceIds.length === 0) {
      throw new MrcInvariantError(
        "Select at least one voided monthly request",
        "NO_REPLACEMENT_SOURCES",
      );
    }
    return prisma.$transaction(
      (tx) => mergeVoidedSourcesIntoDraft(tx, sourceIds, actorId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async findClaimantUserIds(mrcId: string): Promise<string[]> {
    const rows = await prisma.monthlyRequestCollectionItem.findMany({
      where: { monthlyRequestCollectionId: mrcId },
      select: { expenseClaim: { select: { userId: true } } },
      distinct: ["expenseClaimId"],
    });
    return [...new Set(rows.map((row) => row.expenseClaim.userId))];
  },
};
