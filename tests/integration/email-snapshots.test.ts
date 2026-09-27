import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { createEmailDeliveryRepository, enqueueInternalLeaderEmails } from "@/lib/domains/email-delivery/repository";
import { createEmailDeliveryWorkerService } from "@/lib/domains/email-delivery/worker-service";
import { createEmailDeliveryService } from "@/lib/domains/email-delivery/service";
import { evaluateEmailEligibility } from "@/lib/domains/email-delivery/eligibility";
import { createEmailContextSnapshot, parseSnapshot } from "@/lib/domains/email-delivery/snapshots";

const url = new URL(process.env.EMAIL_TEST_DATABASE_URL || "http://invalid");
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
  !["/email_upgrade", "/email_fresh"].includes(url.pathname) ||
  !process.env.EMAIL_TEST_CONTAINER?.startsWith("sraw-email-test-")) {
  throw new Error("Use bun run test:email-db with its disposable database.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
const repository = createEmailDeliveryRepository(prisma);
const accepted = { kind: "accepted", messageId: "<snapshot-fixture@example.test>" } as const;

async function request() {
  await prisma.user.createMany({ data: [
    { id: "snapshot-claimant", keycloakId: "snapshot-claimant", email: "claimant@example.test", firstName: "ผู้ยื่น", lastName: "เดิม" },
    { id: "snapshot-leader", keycloakId: "snapshot-leader", email: "old-leader@example.test", firstName: "หัวหน้า", lastName: "เดิม" },
  ] });
  await prisma.expenseClaim.create({ data: {
    id: "snapshot-claim", userId: "snapshot-claimant", createdById: "snapshot-claimant",
    expenseMonth: new Date("2026-09-01"), claimantPositionAtSubmission: "พนักงาน", status: "PENDING_LEADER_VERIFY",
  } });
  for (const index of [1, 2]) {
    await prisma.offSiteWork.create({ data: {
      id: `snapshot-work-${index}`, innerRefDocumentId: `ORIGINAL-${index}`, startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-02"), postedByUserId: "snapshot-claimant", leaderUserId: "snapshot-leader",
    } });
    await prisma.expenseClaimOffSiteWork.create({ data: { expenseClaimId: "snapshot-claim", offSiteWorkId: `snapshot-work-${index}` } });
    await prisma.leaderVerification.create({ data: {
      id: `snapshot-verification-${index}`, expenseClaimId: "snapshot-claim", offSiteWorkId: `snapshot-work-${index}`,
      leaderUserId: "snapshot-leader", expiresAt: new Date(Date.now() + 86400000),
    } });
  }
  await prisma.$transaction((tx) => enqueueInternalLeaderEmails(tx, "snapshot-claim"));
  return prisma.emailDelivery.findFirstOrThrow();
}

beforeEach(async () => {
  await prisma.emailDelivery.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("historical email context in PostgreSQL", () => {
  it("keeps the queued snapshot immutable while each attempt uses fresh recipients and eligible original orders", async () => {
    const job = await request();
    const queued = parseSnapshot(job.contextSnapshot);
    expect(queued).toMatchObject({ claimantName: "ผู้ยื่น เดิม", leaderName: "หัวหน้า เดิม", recipientEmail: "old-leader@example.test", eligibility: { kind: "queued" } });
    await prisma.user.update({ where: { id: "snapshot-leader" }, data: { firstName: "หัวหน้าใหม่", email: "new-leader@example.test" } });
    await prisma.user.update({ where: { id: "snapshot-claimant" }, data: { firstName: "ผู้ยื่นใหม่" } });
    await prisma.offSiteWork.update({ where: { id: "snapshot-work-1" }, data: { innerRefDocumentId: "UPDATED-1" } });
    // An identical enqueue does not overwrite historical context or add a job.
    await prisma.$transaction((tx) => enqueueInternalLeaderEmails(tx, "snapshot-claim"));
    expect(await prisma.emailDelivery.count()).toBe(1);
    expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { id: job.id } })).contextSnapshot).toEqual(job.contextSnapshot);
    await prisma.leaderVerification.update({ where: { id: "snapshot-verification-2" }, data: { verifiedAt: new Date() } });
    const send = vi.fn().mockResolvedValue(accepted);
    await createEmailDeliveryWorkerService(prisma, send, { workerRunId: "snapshot-worker-run" }).processNext();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "new-leader@example.test", claimantName: "ผู้ยื่นใหม่ เดิม", orders: [expect.objectContaining({ reference: "UPDATED-1" })] }));
    const attempt = await prisma.emailDeliveryAttempt.findFirstOrThrow();
    expect(attempt.workerRunId).toBe("snapshot-worker-run");
    expect(parseSnapshot(attempt.contextSnapshot)).toMatchObject({
      claimantName: "ผู้ยื่นใหม่ เดิม", leaderName: "หัวหน้าใหม่ เดิม", recipientEmail: "new-leader@example.test",
      orders: [{ verificationId: "snapshot-verification-1", state: "PENDING", reference: "UPDATED-1" }, { verificationId: "snapshot-verification-2", state: "VERIFIED" }],
    });
    await prisma.user.deleteMany();
    expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { id: job.id } })).contextSnapshot).toEqual(job.contextSnapshot);
    expect(await prisma.emailDeliveryAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toEqual(attempt);
  });

  it("prepares an attempt only once and rejects stale, expired or finished owners without changing snapshots", async () => {
    await request();
    const job = await repository.claimNext(undefined, { workerRunId: "fenced-run" });
    if (!job) throw new Error("Expected a leased fixture");
    const context = await repository.loadContext(job);
    const snapshot = createEmailContextSnapshot(context, evaluateEmailEligibility(context));
    expect(await repository.prepareAttempt({ ...job, leaseToken: "wrong-token" }, snapshot)).toBe(false);
    expect((await prisma.emailDeliveryAttempt.findUniqueOrThrow({ where: { id: job.attemptId } })).contextSnapshot).toBeNull();
    expect(await repository.prepareAttempt(job, snapshot)).toBe(true);
    const prepared = await prisma.emailDeliveryAttempt.findUniqueOrThrow({ where: { id: job.attemptId } });
    expect(await repository.prepareAttempt(job, { ...snapshot, recipientEmail: "overwrite@example.test" })).toBe(false);
    expect(await prisma.emailDeliveryAttempt.findUniqueOrThrow({ where: { id: job.attemptId } })).toEqual(prepared);
    expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { id: job.id } })).recipientEmail).toBe("old-leader@example.test");
    await prisma.emailDelivery.update({ where: { id: job.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
    expect(await repository.prepareAttempt(job, snapshot)).toBe(false);
    const recovered = await repository.claimNext();
    if (!recovered) throw new Error("Expected recovered fixture");
    expect(await repository.prepareAttempt(job, snapshot)).toBe(false);
    expect(await repository.prepareAttempt(recovered, snapshot)).toBe(true);
    expect(await repository.complete(recovered, { status: "ACCEPTED", messageId: accepted.messageId })).toBe(true);
    expect(await repository.prepareAttempt(recovered, snapshot)).toBe(false);
  });

  it("captures skipped observations without treating replacements or missing sources as historical data", async () => {
    const job = await request();
    await prisma.leaderVerification.delete({ where: { id: "snapshot-verification-1" } });
    await prisma.leaderVerification.create({ data: {
      id: "replacement-verification", expenseClaimId: "snapshot-claim", offSiteWorkId: "snapshot-work-1",
      leaderUserId: "snapshot-leader", expiresAt: new Date(Date.now() + 86400000),
    } });
    await prisma.offSiteWork.update({ where: { id: "snapshot-work-2" }, data: { deletedAt: new Date() } });
    const send = vi.fn().mockResolvedValue(accepted);
    await createEmailDeliveryWorkerService(prisma, send).processNext();
    expect(send).not.toHaveBeenCalled();
    const attempt = await prisma.emailDeliveryAttempt.findFirstOrThrow();
    expect(attempt).toMatchObject({ outcome: "SKIPPED", recipientEmail: null });
    expect(parseSnapshot(attempt.contextSnapshot)).toMatchObject({
      eligibility: { kind: "skipped", code: "NO_PENDING_VERIFICATIONS" },
      orders: [{ verificationId: "snapshot-verification-1", offSiteWorkId: null, reference: null, state: "MISSING" }, { verificationId: "snapshot-verification-2", state: "DELETED" }],
    });
    expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { id: job.id } })).attemptCount).toBe(1);
  });

  it("keeps processing counts separate from manual retry events and preserves all recipient snapshots", async () => {
    const job = await request();
    const send = vi.fn().mockResolvedValueOnce({ kind: "permanent_error", code: "SMTP_PERMANENT_REJECTION" }).mockResolvedValueOnce(accepted);
    const worker = createEmailDeliveryWorkerService(prisma, send);
    await worker.processNext();
    await prisma.user.update({ where: { id: "snapshot-leader" }, data: { email: "retry-recipient@example.test" } });
    expect((await createEmailDeliveryService(prisma).retry(job.id, "fixture-admin")).success).toBe(true);
    const queuedAgain = await prisma.emailDelivery.findUniqueOrThrow({ where: { id: job.id } });
    expect(queuedAgain).toMatchObject({ attemptCount: 1, recipientEmail: "old-leader@example.test" });
    expect(queuedAgain.contextSnapshot).toEqual(job.contextSnapshot);
    await worker.processNext();
    expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { id: job.id } })).attemptCount).toBe(2);
    const attempts = await prisma.emailDeliveryAttempt.findMany({ orderBy: { startedAt: "asc" } });
    expect(attempts).toHaveLength(3);
    expect(attempts.map((attempt) => attempt.outcome)).toEqual(["FAILED", "MANUAL_RETRY", "ACCEPTED"]);
    expect(attempts.map((attempt) => parseSnapshot(attempt.contextSnapshot)?.recipientEmail)).toEqual([
      "old-leader@example.test", "retry-recipient@example.test", "retry-recipient@example.test",
    ]);
    expect(attempts[1].recipientEmail).toBeNull();
    expect(attempts[1].requestedById).toBe("fixture-admin");
  });

  it("does not backfill legacy job or attempt context when a new attempt is created", async () => {
    const job = await request();
    await prisma.emailDelivery.update({ where: { id: job.id }, data: { contextSnapshot: Prisma.DbNull, attemptCount: 1, status: "FAILED" } });
    const legacy = await prisma.emailDeliveryAttempt.create({ data: {
      deliveryId: job.id, attemptNumber: 1, startedAt: new Date(), finishedAt: new Date(), outcome: "FAILED",
      recipientEmail: "previous@example.test",
    } });
    expect((await createEmailDeliveryService(prisma).retry(job.id, "fixture-admin")).success).toBe(true);
    await createEmailDeliveryWorkerService(prisma, vi.fn().mockResolvedValue(accepted)).processNext();
    expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { id: job.id } })).contextSnapshot).toBeNull();
    expect((await prisma.emailDeliveryAttempt.findUniqueOrThrow({ where: { id: legacy.id } })).contextSnapshot).toBeNull();
    const current = await prisma.emailDeliveryAttempt.findFirstOrThrow({ where: { deliveryId: job.id, outcome: "ACCEPTED" } });
    expect(parseSnapshot(current.contextSnapshot)).toMatchObject({ recipientEmail: "old-leader@example.test", eligibility: { kind: "eligible" } });
  });
});
