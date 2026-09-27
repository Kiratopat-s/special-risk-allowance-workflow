import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";
import { createEmailDeliveryRepository, enqueueInternalLeaderEmails } from "./repository";
import type { LeasedEmailDelivery } from "./types";
import type { EmailContextSnapshot } from "./snapshots";

const job = { id: "delivery", leaseToken: "lease", attemptId: "attempt" } as LeasedEmailDelivery;
const snapshot: EmailContextSnapshot = {
  version: 1, capturedAt: "2026-09-27T00:00:00.000Z", claimantName: "Claimant", leaderName: "Leader",
  expenseMonth: "2026-09-01T00:00:00.000Z", recipientEmail: "current@example.test",
  claimStatus: "PENDING_LEADER_VERIFY", recipientStatus: "ACTIVE", eligibility: { kind: "eligible", code: null },
  orders: [],
};
const tx = {
  $queryRaw: vi.fn(),
  emailDelivery: { findFirst: vi.fn(), update: vi.fn() },
  emailDeliveryAttempt: { updateMany: vi.fn() },
};
const client = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
const repository = createEmailDeliveryRepository(client);

beforeEach(() => {
  vi.resetAllMocks();
  tx.$queryRaw.mockResolvedValue([{ id: job.id }]);
  tx.emailDelivery.findFirst.mockResolvedValue({ id: job.id });
  tx.emailDeliveryAttempt.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("fenced attempt snapshot preparation", () => {
  it("checks lease time after waiting for the delivery lock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
    let release!: () => void;
    tx.$queryRaw.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve([{ id: job.id }]); }));
    tx.emailDelivery.findFirst.mockResolvedValue(null);
    const preparing = repository.prepareAttempt(job, snapshot);
    vi.setSystemTime(new Date("2026-09-27T00:02:00Z"));
    release();
    expect(await preparing).toBe(false);
    expect(tx.emailDelivery.findFirst).toHaveBeenCalledWith({
      where: { id: job.id, status: "PROCESSING", leaseToken: job.leaseToken, leaseExpiresAt: { gt: new Date("2026-09-27T00:02:00Z") } },
      select: { id: true },
    });
    expect(tx.emailDeliveryAttempt.updateMany).not.toHaveBeenCalled();
    expect(tx.emailDelivery.update).not.toHaveBeenCalled();
  });

  it("does not change the recipient when an attempt is finished or already snapshotted", async () => {
    tx.emailDeliveryAttempt.updateMany.mockResolvedValue({ count: 0 });
    expect(await repository.prepareAttempt(job, snapshot)).toBe(false);
    expect(tx.emailDeliveryAttempt.updateMany).toHaveBeenCalledWith({
      where: { id: job.attemptId, deliveryId: job.id, finishedAt: null, contextSnapshot: { equals: Prisma.DbNull } },
      data: { contextSnapshot: snapshot, recipientEmail: "current@example.test" },
    });
    expect(tx.emailDelivery.update).not.toHaveBeenCalled();
  });

  it("records failed evaluation metadata without describing its address as an attempted recipient", async () => {
    const failed = { ...snapshot, recipientEmail: "invalid", eligibility: { kind: "failed" as const, code: "INVALID_RECIPIENT" } };
    expect(await repository.prepareAttempt(job, failed)).toBe(true);
    expect(tx.emailDeliveryAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { contextSnapshot: failed } }));
    expect(tx.emailDelivery.update).not.toHaveBeenCalled();
  });

  it("does not update the latest recipient if persisting attempt metadata fails", async () => {
    tx.emailDeliveryAttempt.updateMany.mockRejectedValue(new Error("fixture write failure"));
    await expect(repository.prepareAttempt(job, snapshot)).rejects.toThrow("fixture write failure");
    expect(tx.emailDelivery.update).not.toHaveBeenCalled();
  });
});

describe("bulk enqueue snapshot capture", () => {
  it("shares one claim read across leaders while keeping grouped originals and deterministic dedupe", async () => {
    const records = [
      { id: "verification-b", offSiteWorkId: "work-b", leaderUserId: "leader-a" },
      { id: "verification-a", offSiteWorkId: "work-a", leaderUserId: "leader-a" },
      { id: "verification-c", offSiteWorkId: "work-c", leaderUserId: "leader-b" },
    ].map((record) => ({
      ...record, verifiedAt: null, expiresAt: new Date("2026-09-28T00:00:00Z"),
      leaderUser: { firstName: "หัวหน้า", lastName: record.leaderUserId, email: `${record.leaderUserId}@example.test`, status: "ACTIVE" },
      offSiteWork: { deletedAt: null, innerRefDocumentId: `REF-${record.offSiteWorkId}` },
    }));
    const transaction = {
      leaderVerification: { findMany: vi.fn().mockResolvedValue(records) },
      expenseClaim: { findUnique: vi.fn().mockResolvedValue({
        id: "claim", status: "PENDING_LEADER_VERIFY", cancelledAt: null, monthlyRequestCollectionId: null,
        expenseMonth: new Date("2026-09-01"), claimant: { firstName: "ผู้ยื่น", lastName: "ร่วม" },
        expenseClaimOffSiteWorks: records.map(({ offSiteWorkId }) => ({ offSiteWorkId })),
      }) },
      emailDelivery: { createMany: vi.fn() },
      user: { findUnique: vi.fn() },
    };
    await enqueueInternalLeaderEmails(transaction as unknown as Prisma.TransactionClient, "claim");
    expect(transaction.leaderVerification.findMany).toHaveBeenCalledOnce();
    expect(transaction.expenseClaim.findUnique).toHaveBeenCalledOnce();
    expect(transaction.user.findUnique).not.toHaveBeenCalled();
    const first = transaction.emailDelivery.createMany.mock.calls[0][0];
    expect(first.skipDuplicates).toBe(true);
    expect(first.data).toHaveLength(2);
    expect(first.data[0]).toMatchObject({
      leaderUserId: "leader-a", verificationIds: ["verification-a", "verification-b"], recipientEmail: "leader-a@example.test",
      contextSnapshot: { claimantName: "ผู้ยื่น ร่วม", leaderName: "หัวหน้า leader-a", eligibility: { kind: "queued", code: null },
        orders: [{ verificationId: "verification-a" }, { verificationId: "verification-b" }] },
    });
    expect(first.data[1]).toMatchObject({
      leaderUserId: "leader-b", verificationIds: ["verification-c"], recipientEmail: "leader-b@example.test",
      contextSnapshot: { leaderName: "หัวหน้า leader-b", orders: [{ verificationId: "verification-c" }] },
    });
    transaction.leaderVerification.findMany.mockResolvedValue([...records].reverse());
    await enqueueInternalLeaderEmails(transaction as unknown as Prisma.TransactionClient, "claim");
    const second = transaction.emailDelivery.createMany.mock.calls[1][0];
    const keys = (data: { dedupeKey: string }[]) => data.map((row) => row.dedupeKey).sort();
    expect(keys(second.data)).toEqual(keys(first.data));
    expect(transaction.expenseClaim.findUnique).toHaveBeenCalledTimes(2);
  });
});
