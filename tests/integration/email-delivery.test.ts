import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/lib/generated/prisma/client";
import { createEmailDeliveryRepository, enqueueInternalLeaderEmails } from "@/lib/domains/email-delivery/repository";
import { createEmailDeliveryService } from "@/lib/domains/email-delivery/service";
import { createEmailDeliveryWorkerService } from "@/lib/domains/email-delivery/worker-service";
import type { EmailSendResult } from "@/lib/email/internal-leader";

const url = new URL(process.env.EMAIL_TEST_DATABASE_URL || "http://invalid");
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
  !["/email_upgrade", "/email_fresh"].includes(url.pathname) ||
  !process.env.EMAIL_TEST_CONTAINER?.startsWith("sraw-email-test-")) {
  throw new Error("Use bun run test:email-db with its disposable database.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
const accepted = (): EmailSendResult => ({ kind: "accepted", messageId: "<fixture@example.test>" });

function userData(id: string) {
  return { id, keycloakId: id, email: `${id}@example.test`, peaEmail: `pea-${id}@example.test`, firstName: "ทดสอบ", lastName: id };
}

async function createRequest(
  { claimId = "claim", leaderId = "leader", external = false, workCount = 2 } = {},
  db: Prisma.TransactionClient = prisma,
) {
  await db.user.createMany({ data: [userData("claimant"), userData(leaderId)], skipDuplicates: true });
  await db.expenseClaim.create({ data: {
    id: claimId, expenseMonth: new Date("2026-09-01"), userId: "claimant", createdById: "claimant",
    claimantPositionAtSubmission: "พนักงาน", status: "PENDING_LEADER_VERIFY",
  } });
  const verificationIds: string[] = [];
  for (let index = 0; index < workCount; index++) {
    const workId = `${claimId}-work-${index}`;
    await db.offSiteWork.create({ data: {
      id: workId, innerRefDocumentId: `TZ2609-${index}`, startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-02"), postedByUserId: "claimant",
      leaderUserId: external ? null : leaderId, leaderEmail: "copied-external@example.test",
    } });
    await db.expenseClaimOffSiteWork.create({ data: { expenseClaimId: claimId, offSiteWorkId: workId } });
    const verification = await db.leaderVerification.create({ data: {
      expenseClaimId: claimId, offSiteWorkId: workId, leaderUserId: external ? null : leaderId,
      leaderEmail: "external@example.test", expiresAt: new Date(Date.now() + 86400000),
    } });
    verificationIds.push(verification.id);
  }
  return { claimId, leaderId, verificationIds };
}

async function enqueue(claimId = "claim") {
  await prisma.$transaction((tx) => enqueueInternalLeaderEmails(tx, claimId));
}

/** A loopback-only SMTP capture fixture; it never forwards or delivers mail. */
async function smtpCapture() {
  const messages: string[] = [];
  const recipients: string[] = [];
  const sockets = new Set<Socket>();
  let acknowledge = false;
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    socket.setEncoding("utf8");
    socket.write("220 fixture.example.test ESMTP\r\n");
    let pending = "";
    let data: string[] | null = null;
    let authentication = false;
    socket.on("data", (chunk) => {
      pending += chunk;
      let boundary: number;
      while ((boundary = pending.indexOf("\r\n")) !== -1) {
        const line = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (data) {
          if (line === ".") {
            messages.push(data.join("\r\n"));
            data = null;
            if (acknowledge) socket.write("250 2.0.0 Captured locally\r\n");
          } else data.push(line.replace(/^\.\./, "."));
        } else if (authentication) {
          authentication = false;
          socket.write("235 2.7.0 Authenticated\r\n");
        } else if (/^(EHLO|HELO) /i.test(line)) {
          socket.write("250-fixture.example.test\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        } else if (/^AUTH PLAIN/i.test(line)) {
          if (/^AUTH PLAIN\s+\S+/i.test(line)) socket.write("235 2.7.0 Authenticated\r\n");
          else { authentication = true; socket.write("334 \r\n"); }
        } else if (/^RCPT TO:/i.test(line)) {
          recipients.push(line);
          socket.write("250 2.1.5 Recipient accepted\r\n");
        } else if (/^DATA$/i.test(line)) {
          data = [];
          socket.write("354 End with a dot\r\n");
        } else if (/^QUIT$/i.test(line)) socket.end("221 Goodbye\r\n");
        else socket.write("250 2.0.0 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP fixture did not bind loopback");
  return {
    messages,
    recipients,
    port: address.port,
    accept: () => { acknowledge = true; },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function until(condition: () => boolean | Promise<boolean>, child: ChildProcess) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await condition()) return;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("Worker exited before the expected condition");
    await delay(50);
  }
  throw new Error("Timed out waiting for worker fixture");
}

beforeEach(async () => {
  await prisma.emailDelivery.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("internal leader email delivery with PostgreSQL", () => {
  it("rolls verification records and queued email back together", async () => {
    await expect(prisma.$transaction(async (tx) => {
      await createRequest({}, tx);
      await enqueueInternalLeaderEmails(tx, "claim");
      throw new Error("fixture rollback");
    })).rejects.toThrow("fixture rollback");
    expect(await prisma.expenseClaim.count()).toBe(0);
    expect(await prisma.leaderVerification.count()).toBe(0);
    expect(await prisma.emailDelivery.count()).toBe(0);
  });

  it("deduplicates concurrent enqueue calls and groups several orders for one internal leader", async () => {
    const request = await createRequest();
    await Promise.all(Array.from({ length: 8 }, () => enqueue()));
    const jobs = await prisma.emailDelivery.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].verificationIds.sort()).toEqual(request.verificationIds.sort());
    expect(jobs[0]).toMatchObject({ expenseClaimId: "claim", leaderUserId: "leader", status: "PENDING" });
  });

  it("does not queue external leaders or backfill merely by running the worker", async () => {
    await createRequest();
    await createRequest({ claimId: "external", external: true });
    await enqueue("external");
    const send = vi.fn().mockResolvedValue(accepted());
    expect(await createEmailDeliveryWorkerService(prisma, send).processNext()).toBe(false);
    expect(await prisma.emailDelivery.count()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("separates two internal leaders in one claim and excludes its external leader", async () => {
    await createRequest({ workCount: 3 });
    await prisma.user.create({ data: userData("second-leader") });
    await prisma.offSiteWork.update({ where: { id: "claim-work-1" }, data: { leaderUserId: "second-leader" } });
    await prisma.leaderVerification.updateMany({ where: { offSiteWorkId: "claim-work-1" }, data: { leaderUserId: "second-leader" } });
    await prisma.offSiteWork.update({ where: { id: "claim-work-2" }, data: { leaderUserId: null, leaderEmail: "external@example.test" } });
    await prisma.leaderVerification.updateMany({ where: { offSiteWorkId: "claim-work-2" }, data: { leaderUserId: null, leaderEmail: "external@example.test" } });
    await enqueue();
    expect(await prisma.emailDelivery.count()).toBe(2);
    const send = vi.fn().mockResolvedValue(accepted());
    const worker = createEmailDeliveryWorkerService(prisma, send);
    expect(await worker.processNext()).toBe(true);
    expect(await worker.processNext()).toBe(true);
    expect(await worker.processNext()).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([message]) => ({
      to: message.to,
      references: message.orders.map((order: { reference: string }) => order.reference),
    }))).toEqual(expect.arrayContaining([
      { to: "leader@example.test", references: ["TZ2609-0"] },
      { to: "second-leader@example.test", references: ["TZ2609-1"] },
    ]));
  });

  it("allows only one concurrent worker to send the same job and uses User.email", async () => {
    await createRequest();
    await enqueue();
    const send = vi.fn().mockResolvedValue(accepted());
    const first = createEmailDeliveryWorkerService(prisma, send);
    const second = createEmailDeliveryWorkerService(prisma, send);
    const outcomes = await Promise.all([first.processNext(), second.processNext()]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "leader@example.test" });
    expect(send.mock.calls[0][0].orders).toHaveLength(2);
    expect(await prisma.emailDelivery.findFirst()).toMatchObject({ status: "ACCEPTED", attemptCount: 1 });
    expect(await prisma.emailDeliveryAttempt.count()).toBe(1);
  });

  it("recovers an expired lease and rejects completion or renewal by its former owner", async () => {
    await createRequest();
    await enqueue();
    const repository = createEmailDeliveryRepository(prisma);
    const original = await repository.claimNext();
    expect(original).not.toBeNull();
    if (!original) throw new Error("Expected a leased job");
    expect(await repository.claimNext()).toBeNull();
    await prisma.emailDelivery.update({ where: { id: original.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
    expect(await repository.renewLease(original.id, original.leaseToken)).toBe(false);
    expect(await repository.complete(original, { status: "ACCEPTED", messageId: "<old@example.test>" })).toBe(false);
    const recovered = await repository.claimNext();
    expect(recovered).toMatchObject({ id: original.id, attemptCount: 2 });
    if (!recovered) throw new Error("Expected lease recovery");
    expect(recovered.leaseToken).not.toBe(original.leaseToken);
    expect(await repository.recordRecipient(original, "wrong@example.test")).toBe(false);
    expect(await repository.complete(original, { status: "ACCEPTED" })).toBe(false);
    expect(await repository.renewLease(recovered.id, recovered.leaseToken)).toBe(true);
    expect(await repository.complete(recovered, { status: "ACCEPTED", messageId: "<new@example.test>" })).toBe(true);
    const attempts = await prisma.emailDeliveryAttempt.findMany({ orderBy: { attemptNumber: "asc" } });
    expect(attempts.map((attempt) => attempt.outcome)).toEqual(["INTERRUPTED", "ACCEPTED"]);
    expect(attempts[0].errorCode).toBe("WORKER_INTERRUPTED");
  });

  it("continues to a due job behind an abandoned final attempt without sleeping", async () => {
    await createRequest();
    await enqueue();
    const exhausted = await prisma.emailDelivery.findFirstOrThrow();
    await prisma.emailDelivery.update({ where: { id: exhausted.id }, data: {
      status: "PROCESSING", cycleAttemptCount: 6, attemptCount: 6,
      leaseToken: "abandoned-final-attempt", leaseExpiresAt: new Date(Date.now() - 60000), nextAttemptAt: null,
    } });
    await createRequest({ claimId: "next-claim" });
    await enqueue("next-claim");
    const send = vi.fn().mockResolvedValue(accepted());
    expect(await createEmailDeliveryWorkerService(prisma, send).processNext()).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await prisma.emailDelivery.findUnique({ where: { id: exhausted.id } })).toMatchObject({
      status: "FAILED", lastErrorCode: "RETRY_EXHAUSTED",
    });
    expect(await prisma.emailDelivery.findFirst({ where: { expenseClaimId: "next-claim" } })).toMatchObject({ status: "ACCEPTED" });
  });

  it("retries transient failures only when due and stops after six attempts", async () => {
    await createRequest();
    await enqueue();
    const send = vi.fn().mockResolvedValue({ kind: "retryable_error", code: "SMTP_CONNECTION_FAILED" });
    const worker = createEmailDeliveryWorkerService(prisma, send);
    for (let attempt = 1; attempt <= 6; attempt++) {
      expect(await worker.processNext()).toBe(true);
      const job = await prisma.emailDelivery.findFirstOrThrow();
      expect(job.attemptCount).toBe(attempt);
      if (attempt < 6) {
        expect(job.status).toBe("RETRY_WAIT");
        expect(job.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
        expect(await worker.processNext()).toBe(false);
        await prisma.emailDelivery.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
      } else {
        expect(job).toMatchObject({ status: "FAILED", nextAttemptAt: null });
        expect(await worker.processNext()).toBe(false);
      }
    }
    expect(send).toHaveBeenCalledTimes(6);
    expect(await prisma.emailDeliveryAttempt.count()).toBe(6);
  });

  it.each(["permanent_error", "configuration_error"])("stops a %s without automatic retries", async (kind) => {
    await createRequest();
    await enqueue();
    const send = vi.fn().mockResolvedValue({ kind, code: "FIXTURE_FAILURE" });
    const worker = createEmailDeliveryWorkerService(prisma, send);
    await worker.processNext();
    expect(await prisma.emailDelivery.findFirst()).toMatchObject({ status: "FAILED", nextAttemptAt: null });
    expect(await worker.processNext()).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("queues a failed job only once during concurrent admin retries and preserves its audit history", async () => {
    await createRequest();
    await enqueue();
    const send = vi.fn()
      .mockResolvedValueOnce({ kind: "permanent_error", code: "SMTP_PERMANENT_REJECTION" })
      .mockResolvedValueOnce(accepted());
    const worker = createEmailDeliveryWorkerService(prisma, send);
    await worker.processNext();
    const job = await prisma.emailDelivery.findFirstOrThrow();
    await prisma.user.update({ where: { id: "leader" }, data: { email: "corrected@example.test" } });
    const service = createEmailDeliveryService(prisma);
    const results = await Promise.all([service.retry(job.id, "admin-a"), service.retry(job.id, "admin-b")]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(await prisma.emailDelivery.findUnique({ where: { id: job.id } })).toMatchObject({ status: "PENDING", attemptCount: 1, cycleAttemptCount: 0 });
    await worker.processNext();
    expect(send.mock.calls[1][0]).toMatchObject({ to: "corrected@example.test" });
    const attempts = await prisma.emailDeliveryAttempt.findMany({ where: { deliveryId: job.id } });
    expect(attempts).toHaveLength(3);
    expect(attempts.filter((attempt) => attempt.outcome === "MANUAL_RETRY")).toEqual([
      expect.objectContaining({ requestedById: expect.stringMatching(/^admin-[ab]$/) }),
    ]);
    expect(attempts.find((attempt) => attempt.outcome === "FAILED")?.recipientEmail).toBe("leader@example.test");
    expect(attempts.find((attempt) => attempt.outcome === "ACCEPTED")?.recipientEmail).toBe("corrected@example.test");
    expect((await service.retry(job.id, "admin-a")).success).toBe(false);
  });

  it.each(["cancelled", "verified", "expired", "replaced", "deleted-order", "unlinked-order"])(
    "skips queued email when its original request is %s", async (reason) => {
      await createRequest({ workCount: 1 });
      await enqueue();
      if (reason === "cancelled") {
        await prisma.expenseClaim.update({ where: { id: "claim" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      } else if (reason === "verified") {
        await prisma.leaderVerification.updateMany({ data: { verifiedAt: new Date() } });
      } else if (reason === "expired") {
        await prisma.leaderVerification.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      } else if (reason === "deleted-order") {
        await prisma.offSiteWork.updateMany({ data: { deletedAt: new Date() } });
      } else if (reason === "unlinked-order") {
        await prisma.expenseClaimOffSiteWork.deleteMany();
      } else {
        await prisma.leaderVerification.deleteMany();
        await prisma.leaderVerification.create({ data: {
          expenseClaimId: "claim", offSiteWorkId: "claim-work-0", leaderUserId: "leader",
          expiresAt: new Date(Date.now() + 86400000),
        } });
      }
      const send = vi.fn().mockResolvedValue(accepted());
      await createEmailDeliveryWorkerService(prisma, send).processNext();
      expect(send).not.toHaveBeenCalled();
      expect(await prisma.emailDelivery.findFirst()).toMatchObject({ status: "SKIPPED" });
    },
  );

  it.each(["inactive", "invalid-email"])("fails a %s recipient without SMTP or address fallback", async (reason) => {
    await createRequest();
    await enqueue();
    await prisma.user.update({ where: { id: "leader" }, data: reason === "inactive" ? { status: "INACTIVE" } : { email: "invalid" } });
    const send = vi.fn().mockResolvedValue(accepted());
    await createEmailDeliveryWorkerService(prisma, send).processNext();
    expect(send).not.toHaveBeenCalled();
    expect(await prisma.emailDelivery.findFirst()).toMatchObject({ status: "FAILED" });
  });

  it("keeps accepted history after deleting its source verification, claim and users", async () => {
    await createRequest();
    await enqueue();
    await createEmailDeliveryWorkerService(prisma, vi.fn().mockResolvedValue(accepted())).processNext();
    const job = await prisma.emailDelivery.findFirstOrThrow();
    const attempts = await prisma.emailDeliveryAttempt.findMany();
    await prisma.user.deleteMany();
    expect(await prisma.expenseClaim.count()).toBe(0);
    expect(await prisma.leaderVerification.count()).toBe(0);
    expect(await prisma.emailDelivery.findUnique({ where: { id: job.id } })).toEqual(job);
    expect(await prisma.emailDeliveryAttempt.findMany()).toEqual(attempts);
  });

  it("recovers an actual Bun worker after a crash during loopback SMTP delivery", async () => {
    await createRequest();
    await enqueue();
    const capture = await smtpCapture();
    let worker: ChildProcess | undefined;
    let exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }> | undefined;
    let output = "";
    const start = () => {
      const child = spawn("bun", ["scripts/email-worker.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env, NODE_ENV: "test", DATABASE_URL: url.href,
          EMAIL_HOST: "127.0.0.1", EMAIL_PORT: String(capture.port),
          EMAIL_USER: "fixture", EMAIL_PASS: "fixture", EMAIL_FROM: "SRAW <noreply@example.test>",
          NEXTAUTH_URL: "http://127.0.0.1:3100",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout!.on("data", (chunk) => { output += chunk.toString(); });
      child.stderr!.on("data", (chunk) => { output += chunk.toString(); });
      exited = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });
      return child;
    };
    try {
      worker = start();
      await until(() => capture.messages.length === 1, worker);
      expect(await prisma.emailDelivery.findFirst()).toMatchObject({ status: "PROCESSING", attemptCount: 1 });
      worker.kill("SIGKILL");
      expect(await exited).toMatchObject({ signal: "SIGKILL" });
      await prisma.emailDelivery.updateMany({ data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
      capture.accept();
      worker = start();
      await until(async () => (await prisma.emailDelivery.findFirst())?.status === "ACCEPTED", worker);
      const response = await fetch("http://127.0.0.1:3101/health");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
      expect(capture.messages).toHaveLength(2);
      expect(capture.recipients).toEqual(["RCPT TO:<leader@example.test>", "RCPT TO:<leader@example.test>"]);
      const messageId = (message: string) => message.replace(/\r\n[ \t]+/g, " ")
        .split("\r\n").find((line) => /^Message-ID:/i.test(line))?.slice("Message-ID:".length).trim();
      const firstId = messageId(capture.messages[0]);
      expect(firstId).toBeTruthy();
      expect(messageId(capture.messages[1])).toBe(firstId);
      expect(capture.messages[1]).not.toContain("token=");
      expect((await prisma.emailDeliveryAttempt.findMany({ orderBy: { attemptNumber: "asc" } })).map((attempt) => attempt.outcome))
        .toEqual(["INTERRUPTED", "ACCEPTED"]);
      worker.kill("SIGTERM");
      expect(await exited).toEqual({ code: 0, signal: null });
    } catch (error) {
      console.error(output);
      throw error;
    } finally {
      if (worker && worker.exitCode === null && worker.signalCode === null) {
        worker.kill("SIGKILL");
        await exited;
      }
      await capture.close();
    }
  });
});
