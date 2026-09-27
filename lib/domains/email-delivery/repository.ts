import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type EmailDelivery } from "@/lib/generated/prisma/client";
import { EMAIL_LEASE_MS, EMAIL_RETRY_DELAYS_MS } from "./types";
import type { EmailDeliveryCompletion, EmailDeliveryFilter, LeasedEmailDelivery } from "./types";
import { createEmailContextSnapshot, type EmailContextSnapshot } from "./snapshots";
import { evaluateEmailEligibility } from "./eligibility";

type ContextClient = Pick<Prisma.TransactionClient, "expenseClaim" | "leaderVerification" | "user">;

const claimContextSelect = {
  id: true, status: true, cancelledAt: true, monthlyRequestCollectionId: true, expenseMonth: true,
  claimant: { select: { firstName: true, lastName: true } },
  expenseClaimOffSiteWorks: { select: { offSiteWorkId: true } },
} satisfies Prisma.ExpenseClaimSelect;
const leaderContextSelect = { email: true, status: true, firstName: true, lastName: true } satisfies Prisma.UserSelect;
const verificationContextSelect = {
  id: true, offSiteWorkId: true, verifiedAt: true, expiresAt: true,
  offSiteWork: { select: { deletedAt: true, innerRefDocumentId: true } },
} satisfies Prisma.LeaderVerificationSelect;

/** Call only in the transaction that creates this verification generation. */
export async function enqueueInternalLeaderEmails(tx: Prisma.TransactionClient, expenseClaimId: string): Promise<void> {
  const records = await tx.leaderVerification.findMany({
    where: { expenseClaimId, leaderUserId: { not: null }, verifiedAt: null },
    select: { ...verificationContextSelect, leaderUserId: true, leaderUser: { select: leaderContextSelect } },
  });
  const groups = new Map<string, { leader: (typeof records)[number]["leaderUser"]; records: typeof records }>();
  for (const record of records) {
    if (!record.leaderUserId) continue;
    const group = groups.get(record.leaderUserId) ?? { leader: record.leaderUser, records: [] };
    group.records.push(record);
    groups.set(record.leaderUserId, group);
  }
  if (!groups.size) return;
  // All leaders share one claim; fetch it once and reuse the bulk-loaded relations.
  const claim = await tx.expenseClaim.findUnique({ where: { id: expenseClaimId }, select: claimContextSelect });
  const capturedAt = new Date();
  const data = [...groups].map(([leaderUserId, group]) => {
      const verificationIds = group.records.map((record) => record.id).sort();
      const dedupeKey = createHash("sha256")
        .update(JSON.stringify(["INTERNAL_LEADER_VERIFY", expenseClaimId, leaderUserId, verificationIds])).digest("hex");
      const context: EmailContext = { claim, leader: group.leader, verifications: group.records, verificationIds };
      return {
        expenseClaimId, leaderUserId, verificationIds, dedupeKey, recipientEmail: context.leader?.email ?? null,
        contextSnapshot: createEmailContextSnapshot(context, { kind: "queued" }, capturedAt),
      };
    });
  await tx.emailDelivery.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function loadEmailContext(client: ContextClient, delivery: Pick<EmailDelivery, "expenseClaimId" | "leaderUserId" | "verificationIds">) {
  // This helper also receives transaction clients, which share one PostgreSQL
  // connection and must finish each query before issuing the next one.
  const claim = await client.expenseClaim.findUnique({
    where: { id: delivery.expenseClaimId },
    select: claimContextSelect,
  });
  const leader = await client.user.findUnique({ where: { id: delivery.leaderUserId }, select: leaderContextSelect });
  const verifications = await client.leaderVerification.findMany({
    where: { id: { in: delivery.verificationIds }, expenseClaimId: delivery.expenseClaimId, leaderUserId: delivery.leaderUserId },
    select: verificationContextSelect,
    orderBy: { id: "asc" },
  });
  return { claim, leader, verifications, verificationIds: [...delivery.verificationIds] };
}

export type EmailContext = Awaited<ReturnType<typeof loadEmailContext>>;

export function createEmailDeliveryRepository(client: PrismaClient) {
  return {
    loadContext: (delivery: Pick<EmailDelivery, "expenseClaimId" | "leaderUserId" | "verificationIds">) => loadEmailContext(client, delivery),

    async claimNext(now?: Date, options: { workerRunId?: string } = {}): Promise<LeasedEmailDelivery | null> {
      // Terminalize abandoned final attempts without making a nonempty queue
      // look idle (and delaying each remaining job by another polling interval).
      while (true) {
        const claimedAt = now ?? new Date();
        const claimed = await client.$transaction<LeasedEmailDelivery | "exhausted" | null>(async (tx) => {
          const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM email_deliveries
            WHERE (status IN ('PENDING', 'RETRY_WAIT') AND next_attempt_at <= ${claimedAt})
               OR (status = 'PROCESSING' AND lease_expires_at <= ${claimedAt})
            ORDER BY COALESCE(next_attempt_at, lease_expires_at), created_at, id
            LIMIT 1 FOR UPDATE SKIP LOCKED
          `;
          if (!rows.length) return null;
          const current = await tx.emailDelivery.findUniqueOrThrow({ where: { id: rows[0].id } });
          await tx.emailDeliveryAttempt.updateMany({
            where: { deliveryId: current.id, finishedAt: null },
            data: { finishedAt: claimedAt, outcome: "INTERRUPTED", errorCode: "WORKER_INTERRUPTED" },
          });
          // A crash during the last attempt must not grant unlimited retries.
          if (current.cycleAttemptCount >= EMAIL_RETRY_DELAYS_MS.length + 1) {
            await tx.emailDelivery.update({ where: { id: current.id }, data: {
              status: "FAILED", lastErrorCode: "RETRY_EXHAUSTED", leaseToken: null, leaseExpiresAt: null, nextAttemptAt: null,
            } });
            return "exhausted";
          }
          const leaseToken = randomUUID();
          const job = await tx.emailDelivery.update({ where: { id: current.id }, data: {
            status: "PROCESSING", leaseToken, leaseExpiresAt: new Date(claimedAt.getTime() + EMAIL_LEASE_MS),
            nextAttemptAt: null, attemptCount: { increment: 1 }, cycleAttemptCount: { increment: 1 },
          } });
          const attempt = await tx.emailDeliveryAttempt.create({ data: {
            deliveryId: job.id, attemptNumber: job.attemptCount, startedAt: claimedAt,
            workerRunId: options.workerRunId ?? null,
          } });
          return { ...job, leaseToken, attemptId: attempt.id };
        });
        if (claimed !== "exhausted") return claimed;
      }
    },

    async renewLease(id: string, leaseToken: string, now = new Date()): Promise<boolean> {
      const result = await client.emailDelivery.updateMany({
        where: { id, status: "PROCESSING", leaseToken, leaseExpiresAt: { gt: now } },
        data: { leaseExpiresAt: new Date(now.getTime() + EMAIL_LEASE_MS) },
      });
      return result.count === 1;
    },

    async prepareAttempt(job: LeasedEmailDelivery, snapshot: EmailContextSnapshot, now?: Date): Promise<boolean> {
      return client.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM email_deliveries WHERE id = ${job.id} FOR UPDATE
        `;
        if (!rows.length) return false;
        // Recheck time and ownership after waiting for the row lock.
        const owned = await tx.emailDelivery.findFirst({
          where: { id: job.id, status: "PROCESSING", leaseToken: job.leaseToken, leaseExpiresAt: { gt: now ?? new Date() } },
          select: { id: true },
        });
        if (!owned) return false;
        const email = snapshot.eligibility.kind === "eligible" ? snapshot.recipientEmail : null;
        const prepared = await tx.emailDeliveryAttempt.updateMany({
          where: { id: job.attemptId, deliveryId: job.id, finishedAt: null, contextSnapshot: { equals: Prisma.DbNull } },
          data: { contextSnapshot: snapshot, ...(email !== null ? { recipientEmail: email } : {}) },
        });
        if (prepared.count !== 1) return false;
        if (email !== null) await tx.emailDelivery.update({ where: { id: job.id }, data: { recipientEmail: email } });
        return true;
      });
    },

    async complete(job: LeasedEmailDelivery, result: EmailDeliveryCompletion, now = new Date()): Promise<boolean> {
      return client.$transaction(async (tx) => {
        const updated = await tx.emailDelivery.updateMany({
          where: { id: job.id, status: "PROCESSING", leaseToken: job.leaseToken, leaseExpiresAt: { gt: now } },
          data: {
            status: result.status, lastErrorCode: result.code ?? null,
            nextAttemptAt: result.nextAttemptAt ?? null, leaseToken: null, leaseExpiresAt: null,
            ...(result.status === "ACCEPTED" ? { acceptedAt: now, messageId: result.messageId } : {}),
          },
        });
        if (updated.count !== 1) return false;
        await tx.emailDeliveryAttempt.update({ where: { id: job.attemptId }, data: {
          finishedAt: now, outcome: result.status, errorCode: result.code ?? null, messageId: result.messageId ?? null,
        } });
        return true;
      });
    },

    async list(filter: EmailDeliveryFilter) {
      const pageSize = 25;
      const search = filter.search?.trim().slice(0, 200);
      const where: Prisma.EmailDeliveryWhereInput = {
        ...(filter.status ? { status: filter.status } : {}),
        ...(search ? { OR: [
          { expenseClaimId: { contains: search, mode: "insensitive" } },
          { leaderUserId: { contains: search, mode: "insensitive" } },
          { recipientEmail: { contains: search, mode: "insensitive" } },
        ] } : {}),
      };
      const total = await client.emailDelivery.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(Math.max(1, Math.trunc(filter.page ?? 1)), totalPages);
      const data = await client.emailDelivery.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
        include: { attempts: { orderBy: [{ startedAt: "desc" }, { id: "desc" }] } },
      });
      return { data, pagination: { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 } };
    },

    async retryFailed(id: string, actorId: string, isEligible: (context: EmailContext) => boolean): Promise<"queued" | "not_failed" | "ineligible"> {
      return client.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM email_deliveries WHERE id = ${id} FOR UPDATE`;
        if (!rows.length) return "not_failed";
        const job = await tx.emailDelivery.findUniqueOrThrow({ where: { id } });
        if (job.status !== "FAILED") return "not_failed";
        const context = await loadEmailContext(tx, job);
        const now = new Date();
        const eligibility = evaluateEmailEligibility(context, now);
        if (!isEligible(context) || eligibility.kind !== "eligible") return "ineligible";
        await tx.emailDelivery.update({ where: { id }, data: {
          status: "PENDING", cycleAttemptCount: 0, nextAttemptAt: now,
          leaseToken: null, leaseExpiresAt: null, lastErrorCode: null,
        } });
        // Audit events retain the cumulative attempt number but do not count as sends.
        await tx.emailDeliveryAttempt.create({ data: {
          deliveryId: id, attemptNumber: job.attemptCount, startedAt: now, finishedAt: now,
          outcome: "MANUAL_RETRY", requestedById: actorId,
          contextSnapshot: createEmailContextSnapshot(context, eligibility, now),
        } });
        return "queued";
      });
    },
  };
}
