import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, EmailDelivery } from "@/lib/generated/prisma/client";
import { EMAIL_LEASE_MS, EMAIL_RETRY_DELAYS_MS } from "./types";
import type { EmailDeliveryCompletion, EmailDeliveryFilter, LeasedEmailDelivery } from "./types";

type ContextClient = Pick<Prisma.TransactionClient, "expenseClaim" | "leaderVerification" | "user">;

/** Call only in the transaction that creates this verification generation. */
export async function enqueueInternalLeaderEmails(tx: Prisma.TransactionClient, expenseClaimId: string): Promise<void> {
  const records = await tx.leaderVerification.findMany({
    where: { expenseClaimId, leaderUserId: { not: null }, verifiedAt: null },
    select: { id: true, leaderUserId: true, leaderUser: { select: { email: true } } },
  });
  const groups = new Map<string, { ids: string[]; email: string | null }>();
  for (const record of records) {
    if (!record.leaderUserId) continue;
    const group = groups.get(record.leaderUserId) ?? { ids: [], email: record.leaderUser?.email ?? null };
    group.ids.push(record.id);
    groups.set(record.leaderUserId, group);
  }
  if (!groups.size) return;
  await tx.emailDelivery.createMany({
    data: [...groups].map(([leaderUserId, group]) => {
      const verificationIds = group.ids.sort();
      const dedupeKey = createHash("sha256")
        .update(JSON.stringify(["INTERNAL_LEADER_VERIFY", expenseClaimId, leaderUserId, verificationIds])).digest("hex");
      return { expenseClaimId, leaderUserId, verificationIds, dedupeKey, recipientEmail: group.email };
    }),
    skipDuplicates: true,
  });
}

export async function loadEmailContext(client: ContextClient, delivery: Pick<EmailDelivery, "expenseClaimId" | "leaderUserId" | "verificationIds">) {
  const [claim, leader, verifications] = await Promise.all([
    client.expenseClaim.findUnique({
      where: { id: delivery.expenseClaimId },
      select: {
        id: true, status: true, cancelledAt: true, monthlyRequestCollectionId: true, expenseMonth: true,
        claimant: { select: { firstName: true, lastName: true } },
        expenseClaimOffSiteWorks: { select: { offSiteWorkId: true } },
      },
    }),
    client.user.findUnique({ where: { id: delivery.leaderUserId }, select: { email: true, status: true } }),
    client.leaderVerification.findMany({
      where: { id: { in: delivery.verificationIds }, expenseClaimId: delivery.expenseClaimId, leaderUserId: delivery.leaderUserId },
      select: {
        id: true, offSiteWorkId: true, verifiedAt: true, expiresAt: true,
        offSiteWork: { select: { deletedAt: true, innerRefDocumentId: true } },
      },
      orderBy: { id: "asc" },
    }),
  ]);
  return { claim, leader, verifications };
}

export type EmailContext = Awaited<ReturnType<typeof loadEmailContext>>;

export function createEmailDeliveryRepository(client: PrismaClient) {
  return {
    loadContext: (delivery: Pick<EmailDelivery, "expenseClaimId" | "leaderUserId" | "verificationIds">) => loadEmailContext(client, delivery),

    async claimNext(now?: Date): Promise<LeasedEmailDelivery | null> {
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

    async recordRecipient(job: LeasedEmailDelivery, email: string, now = new Date()): Promise<boolean> {
      return client.$transaction(async (tx) => {
        const result = await tx.emailDelivery.updateMany({
          where: { id: job.id, status: "PROCESSING", leaseToken: job.leaseToken, leaseExpiresAt: { gt: now } },
          data: { recipientEmail: email },
        });
        if (result.count !== 1) return false;
        await tx.emailDeliveryAttempt.update({ where: { id: job.attemptId }, data: { recipientEmail: email } });
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
        if (!isEligible(await loadEmailContext(tx, job))) return "ineligible";
        const now = new Date();
        await tx.emailDelivery.update({ where: { id }, data: {
          status: "PENDING", cycleAttemptCount: 0, nextAttemptAt: now,
          leaseToken: null, leaseExpiresAt: null, lastErrorCode: null,
        } });
        // Audit events retain the cumulative attempt number but do not count as sends.
        await tx.emailDeliveryAttempt.create({ data: {
          deliveryId: id, attemptNumber: job.attemptCount, startedAt: now, finishedAt: now,
          outcome: "MANUAL_RETRY", requestedById: actorId,
        } });
        return "queued";
      });
    },
  };
}
