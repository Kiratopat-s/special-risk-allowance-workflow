import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  LeaderVerificationEntity,
  LeaderVerificationPayload,
  LeaderVerificationWithRelations,
} from "./types";
import { claimantFromVerificationSnapshot } from "./snapshot";

function asPayload(value: Prisma.JsonValue): LeaderVerificationPayload {
  return value as unknown as LeaderVerificationPayload;
}

type RawVerification = Awaited<ReturnType<typeof findRawById>>;
type TransactionClient = Prisma.TransactionClient;

async function findRawById(id: string, tx?: TransactionClient) {
  const db = tx ?? prisma;
  return db.leaderVerification.findUnique({
    where: { id },
    include: {
      claimRevision: {
        include: {
          expenseClaim: true,
        },
      },
      revisionOffSiteWork: true,
    },
  });
}

function mapRecord(row: NonNullable<RawVerification>): LeaderVerificationWithRelations {
  const payload = asPayload(row.payloadSnapshot);
  const claim = row.claimRevision.expenseClaim;
  const osw = row.revisionOffSiteWork;
  return {
    id: row.id,
    claimRevisionId: row.claimRevisionId,
    revisionOffSiteWorkId: row.revisionOffSiteWorkId,
    status: row.status,
    leaderUserId: row.leaderUserId,
    leaderEmpIdSnapshot: row.leaderEmpIdSnapshot,
    leaderFirstNameSnapshot: row.leaderFirstNameSnapshot,
    leaderLastNameSnapshot: row.leaderLastNameSnapshot,
    leaderPositionSnapshot: row.leaderPositionSnapshot,
    leaderEmailSnapshot: row.leaderEmailSnapshot,
    expiresAt: row.expiresAt,
    payloadSnapshot: payload,
    payloadHash: row.payloadHash,
    confirmedAt: row.confirmedAt,
    supersededAt: row.supersededAt,
    createdAt: row.createdAt,
    expenseClaimId: claim.id,
    revisionNo: row.claimRevision.revisionNo,
    expenseClaim: {
      id: claim.id,
      expenseMonth: new Date(`${payload.claim.expenseMonth}T00:00:00.000Z`),
      userId: claim.userId,
      status: claim.status,
      claimantPositionAtSubmission: payload.claim.claimant.positionShort,
      claimant: claimantFromVerificationSnapshot(payload, claim.userId),
    },
    offSiteWorkId: osw.offSiteWorkId,
    offSiteWork: {
      id: osw.offSiteWorkId,
      innerRefDocumentId: osw.innerRefDocumentIdSnapshot,
      startDate: osw.startDateSnapshot,
      endDate: osw.endDateSnapshot,
      location: osw.locationSnapshot,
      objective: osw.objectiveSnapshot,
      leaderFirstName: osw.leaderFirstNameSnapshot,
      leaderLastName: osw.leaderLastNameSnapshot,
      leaderPosition: osw.leaderPositionSnapshot,
      leaderEmpId: osw.leaderEmpIdSnapshot,
    },
    confirmedDates: payload.dates.map((item) => item.date),
    confirmedDayCount: payload.countDates,
    amount: payload.amount,
  };
}

export const leaderVerificationRepository = {
  findRevisionForVerification(revisionId: string, tx?: TransactionClient) {
    const db = tx ?? prisma;
    return db.expenseClaimRevision.findUnique({
      where: { id: revisionId },
      include: {
        expenseClaim: true,
        offSiteWorks: { orderBy: { createdAt: "asc" } },
        workDates: {
          orderBy: { workDate: "asc" },
          include: { weSafeCodes: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
  },

  async create(input: {
    claimRevisionId: string;
    revisionOffSiteWorkId: string;
    leaderUserId: string | null;
    leaderEmpIdSnapshot: string | null;
    leaderFirstNameSnapshot: string;
    leaderLastNameSnapshot: string;
    leaderPositionSnapshot: string | null;
    leaderEmailSnapshot: string | null;
    tokenHash: string;
    expiresAt: Date;
    payloadSnapshot: LeaderVerificationPayload;
    payloadHash: string;
  }, tx?: TransactionClient): Promise<LeaderVerificationEntity> {
    const db = tx ?? prisma;
    const row = await db.leaderVerification.create({
      data: {
        ...input,
        payloadSnapshot: input.payloadSnapshot as unknown as Prisma.InputJsonValue,
      },
    });
    return { ...row, payloadSnapshot: asPayload(row.payloadSnapshot) };
  },

  async findByTokenHash(hash: string): Promise<LeaderVerificationWithRelations | null> {
    const row = await prisma.leaderVerification.findUnique({
      where: { tokenHash: hash },
      select: { id: true },
    });
    if (!row) return null;
    const full = await findRawById(row.id);
    return full ? mapRecord(full) : null;
  },

  async findById(id: string): Promise<LeaderVerificationWithRelations | null> {
    const row = await findRawById(id);
    return row ? mapRecord(row) : null;
  },

  async findByRevisionAndOsw(
    revisionId: string,
    revisionOffSiteWorkId: string,
  ): Promise<LeaderVerificationWithRelations | null> {
    const row = await prisma.leaderVerification.findUnique({
      where: { revisionOffSiteWorkId },
      select: { id: true, claimRevisionId: true },
    });
    if (!row || row.claimRevisionId !== revisionId) return null;
    const full = await findRawById(row.id);
    return full ? mapRecord(full) : null;
  },

  async findForLeader(
    userId: string,
    view: "pending" | "history" | "all",
  ): Promise<LeaderVerificationWithRelations[]> {
    const rows = await prisma.leaderVerification.findMany({
      where: {
        leaderUserId: userId,
        ...(view === "pending"
          ? { status: "PENDING", confirmedAt: null, expiresAt: { gt: new Date() } }
          : view === "history"
            ? { OR: [{ status: "CONFIRMED" }, { status: "SUPERSEDED" }] }
            : {}),
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    const records = await Promise.all(
      rows.map(async (row) => {
        const full = await findRawById(row.id);
        return full ? mapRecord(full) : null;
      }),
    );
    return records.filter((item): item is LeaderVerificationWithRelations => item !== null);
  },

  async confirmCurrent(
    id: string,
    signatureData: Buffer,
  ): Promise<
    | { outcome: "CONFIRMED"; allDone: boolean; expenseClaimId: string }
    | { outcome: "NOT_FOUND" }
    | { outcome: "NOT_CURRENT" }
    | { outcome: "EXPIRED" }
  > {
    return prisma.$transaction(
      async (tx) => {
        const record = await tx.leaderVerification.findUnique({
          where: { id },
          include: {
            claimRevision: {
              select: {
                revisionNo: true,
                status: true,
                expenseClaim: {
                  select: { id: true, status: true, currentRevisionNo: true },
                },
              },
            },
          },
        });
        if (!record) return { outcome: "NOT_FOUND" as const };
        if (record.expiresAt <= new Date()) return { outcome: "EXPIRED" as const };
        const claim = record.claimRevision.expenseClaim;
        if (
          record.status !== "PENDING" ||
          record.confirmedAt ||
          record.supersededAt ||
          record.claimRevision.status !== "SUBMITTED" ||
          record.claimRevision.revisionNo !== claim.currentRevisionNo ||
          claim.status !== "PENDING_LEADER_CONFIRMATION"
        ) {
          return { outcome: "NOT_CURRENT" as const };
        }

        const confirmedAt = new Date();
        const changed = await tx.leaderVerification.updateMany({
          where: {
            id,
            status: "PENDING",
            confirmedAt: null,
            supersededAt: null,
            expiresAt: { gt: confirmedAt },
            claimRevision: {
              status: "SUBMITTED",
              revisionNo: claim.currentRevisionNo,
              expenseClaim: {
                id: claim.id,
                status: "PENDING_LEADER_CONFIRMATION",
                currentRevisionNo: claim.currentRevisionNo,
              },
            },
          },
          data: {
            status: "CONFIRMED",
            confirmedAt,
            signatureData: new Uint8Array(signatureData),
          },
        });
        if (changed.count !== 1) return { outcome: "NOT_CURRENT" as const };

        const [total, confirmed] = await Promise.all([
          tx.leaderVerification.count({
            where: { claimRevisionId: record.claimRevisionId, supersededAt: null },
          }),
          tx.leaderVerification.count({
            where: {
              claimRevisionId: record.claimRevisionId,
              supersededAt: null,
              status: "CONFIRMED",
              confirmedAt: { not: null },
            },
          }),
        ]);
        const allDone = total > 0 && total === confirmed;
        if (allDone) {
          const updated = await tx.expenseClaim.updateMany({
            where: { id: claim.id, status: "PENDING_LEADER_CONFIRMATION" },
            data: { status: "READY_FOR_COLLECTION" },
          });
          if (updated.count !== 1) return { outcome: "NOT_CURRENT" as const };
        }
        return {
          outcome: "CONFIRMED" as const,
          allDone,
          expenseClaimId: claim.id,
        };
      },
      { isolationLevel: "Serializable" },
    );
  },

  async rotateToken(id: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const result = await prisma.leaderVerification.updateMany({
      where: { id, status: "PENDING", confirmedAt: null, supersededAt: null },
      data: { tokenHash, expiresAt },
    });
    if (result.count !== 1) throw new Error("Verification is no longer pending");
  },
};
