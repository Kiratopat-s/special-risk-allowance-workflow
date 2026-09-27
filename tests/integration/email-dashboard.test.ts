import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/lib/generated/prisma/client";
import { createEmailDashboardService } from "@/lib/domains/email-delivery/dashboard-service";
import type { EmailContextSnapshot } from "@/lib/domains/email-delivery/snapshots";

const url = new URL(process.env.EMAIL_TEST_DATABASE_URL || "http://invalid");
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
  !["/email_upgrade", "/email_fresh"].includes(url.pathname) || !process.env.EMAIL_TEST_CONTAINER?.startsWith("sraw-email-test-")) {
  throw new Error("Use bun run test:email-db with its disposable database.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
const service = createEmailDashboardService(prisma);
const snapshot: EmailContextSnapshot = {
  version: 1, capturedAt: "2026-09-27T00:00:00.000Z", claimantName: "ผู้ยื่น เดิม", leaderName: "หัวหน้า เดิม",
  expenseMonth: "2026-09-01T00:00:00.000Z", recipientEmail: "queued@example.test", claimStatus: "PENDING_LEADER_VERIFY",
  recipientStatus: "ACTIVE", eligibility: { kind: "queued", code: null },
  orders: [{ verificationId: "old-verification", offSiteWorkId: "old-order", reference: "ORDER-OLD-100%", expiresAt: "2026-10-01T00:00:00.000Z", state: "PENDING" }],
};
async function job(id: string, overrides: Partial<Prisma.EmailDeliveryCreateInput> = {}) {
  return prisma.emailDelivery.create({ data: { id, dedupeKey: id, expenseClaimId: `claim-${id}`,
    leaderUserId: `leader-${id}`, verificationIds: ["old-verification"], ...overrides } });
}
beforeEach(async () => {
  await prisma.emailDelivery.deleteMany();
  await prisma.emailWorkerRun.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe("email worker dashboard PostgreSQL reads", () => {
  it("counts the full queue independently of paginated/filter results and separates stale leases", async () => {
    const now = new Date();
    await prisma.emailDelivery.createMany({ data: Array.from({ length: 30 }, (_, index) => ({
      id: `pending-${index}`, dedupeKey: `pending-${index}`, expenseClaimId: `c-${index}`, leaderUserId: "leader",
      verificationIds: [], nextAttemptAt: new Date(now.getTime() - 60000),
    })) });
    await job("retry", { status: "RETRY_WAIT", nextAttemptAt: new Date(now.getTime() + 600000) });
    await job("stale", { status: "PROCESSING", leaseExpiresAt: new Date(now.getTime() - 1), nextAttemptAt: null });
    await job("failed", { status: "FAILED", nextAttemptAt: null });
    await job("accepted", { status: "ACCEPTED", acceptedAt: now });
    await job("accepted-old", { status: "ACCEPTED", acceptedAt: new Date(now.getTime() - 86400001) });
    const overview = await service.overview();
    expect(overview).toMatchObject({ success: true, data: { readyCount: 30, retryWaitCount: 1, processingCount: 1,
      expiredLeaseCount: 1, failedCount: 1, acceptedLast24HoursCount: 1, activeWorkerCount: 0, workers: [] } });
    const first = await service.list({ status: "PENDING" });
    expect(first.success && first.data.data).toHaveLength(25);
    expect(first.success && first.data.pagination).toMatchObject({ page: 1, total: 30, hasNext: true });
    const last = await service.list({ status: "PENDING", page: 999 });
    expect(last.success && last.data.data).toHaveLength(5);
    expect(last.success && last.data.pagination.page).toBe(2);
    expect(first.success && first.data.data.every((row) => !("attempts" in row) && !("leaseToken" in row))).toBe(true);
  });

  it("uses inclusive Bangkok calendar dates and literal search characters", async () => {
    await job("before", { createdAt: new Date("2026-09-26T16:59:59.999Z") });
    await job("start", { createdAt: new Date("2026-09-26T17:00:00Z"), contextSnapshot: snapshot });
    await job("end", { createdAt: new Date("2026-09-27T16:59:59.999Z") });
    await job("after", { createdAt: new Date("2026-09-27T17:00:00Z") });
    const range = await service.list({ from: "2026-09-27", to: "2026-09-27" });
    expect(range.success && range.data.data.map((row) => row.id)).toEqual(["end", "start"]);
    for (const search of ["ผู้ยื่น เดิม", "หัวหน้า เดิม", "ORDER-OLD", "100%", "old-order", "queued@example.test"]) {
      const result = await service.list({ search });
      expect(result.success && result.data.data.map((row) => row.id)).toEqual(["start"]);
    }
    const wildcard = await service.list({ search: "%" });
    expect(wildcard.success && wildcard.data.pagination.total).toBe(1);
  });

  it("searches historical recipients, paginates attempts and never returns raw internal diagnostics", async () => {
    await job("history", { contextSnapshot: { ...snapshot, token: "private-token" }, recipientEmail: "latest@example.test",
      attemptCount: 26, cycleAttemptCount: 2, status: "FAILED", lastErrorCode: "secret:password",
      leaseToken: "private-lease", messageId: "raw smtp error secret" });
    await prisma.emailDeliveryAttempt.createMany({ data: Array.from({ length: 26 }, (_, i) => ({
      deliveryId: "history", attemptNumber: i + 1, recipientEmail: `recipient-${i}@example.test`,
      startedAt: new Date(Date.UTC(2026, 8, 27, 0, i)), finishedAt: new Date(Date.UTC(2026, 8, 27, 0, i, 1)),
      outcome: "FAILED", errorCode: "secret:password", contextSnapshot: snapshot,
    })) });
    await prisma.emailDeliveryAttempt.create({ data: { deliveryId: "history", attemptNumber: 26,
      outcome: "MANUAL_RETRY", requestedById: "deleted-admin", startedAt: new Date("2026-09-27T01:00:00Z"),
      contextSnapshot: { ...snapshot, recipientEmail: "observed-only@example.test" } } });
    const found = await service.list({ search: "recipient-0@example.test" });
    expect(found.success && found.data.data.map((row) => row.id)).toEqual(["history"]);
    const observed = await service.list({ search: "observed-only@example.test" });
    expect(observed.success && observed.data.data.map((row) => row.id)).toEqual(["history"]);
    const detail = await service.detail("history");
    expect(detail).toMatchObject({ success: true, data: { attemptCount: 26, cycleAttemptCount: 2,
      contextSource: "SNAPSHOT", claimantName: snapshot.claimantName, canRetry: false, lastErrorCode: "UNKNOWN_ERROR",
      attempts: { pagination: { total: 27, page: 1 } } } });
    expect(detail.success && detail.data.attempts.data).toHaveLength(25);
    expect(detail.success && detail.data.attempts.data[0]).toMatchObject({ outcome: "MANUAL_RETRY", requestedById: "deleted-admin", requestedByName: null });
    const second = await service.detail("history", 2);
    expect(second.success && second.data.attempts.data).toHaveLength(2);
    expect(second.success && second.data.attempts.data[0].errorCode).toBe("UNKNOWN_ERROR");
    const serialized = JSON.stringify(detail);
    for (const secret of ["private-token", "private-lease", "secret:password", "raw smtp error"]) expect(serialized).not.toContain(secret);
  });

  it("identifies legacy missing history and exposes current context separately", async () => {
    await prisma.user.createMany({ data: ["claimant", "leader"].map((id) => ({
      id, keycloakId: id, email: `${id}@example.test`, firstName: "ปัจจุบัน", lastName: id,
    })) });
    await prisma.expenseClaim.create({ data: { id: "current-claim", expenseMonth: new Date("2026-09-01"),
      userId: "claimant", createdById: "claimant", claimantPositionAtSubmission: "staff" } });
    await job("legacy", { expenseClaimId: "current-claim", leaderUserId: "leader" });
    const detail = await service.detail("legacy");
    expect(detail).toMatchObject({ success: true, data: { contextSnapshot: null, contextSource: "CURRENT",
      currentContext: { recipientEmail: "leader@example.test", claimantName: "ปัจจุบัน claimant" } } });
    await prisma.user.deleteMany();
    const missing = await service.detail("legacy");
    expect(missing).toMatchObject({ success: true, data: { contextSource: "UNAVAILABLE", contextSnapshot: null,
      currentContext: { claimantName: null, leaderName: null, orders: [{ state: "MISSING" }] } } });
    expect(await service.detail("missing")).toMatchObject({ success: false, code: "EMAIL_NOT_FOUND" });
  });

  it("does not let an old stopped/stale instance hide a healthy worker and sanitizes runtime errors", async () => {
    const now = new Date();
    await prisma.emailWorkerRun.createMany({ data: [
      { id: "live", lastHeartbeatAt: now, lastProgressAt: now },
      { id: "stopped", stoppedAt: now },
      { id: "old", lastHeartbeatAt: new Date(now.getTime() - 120000), lastErrorCode: "postgresql://private-password@host" },
    ] });
    const result = await service.overview();
    expect(result.success && result.data.activeWorkerCount).toBe(1);
    expect(result.success && result.data.workers.find((row) => row.id === "live")?.state).toBe("IDLE");
    expect(result.success && result.data.workers.find((row) => row.id === "old")).toMatchObject({ state: "NO_SIGNAL", lastErrorCode: "UNKNOWN_ERROR" });
    expect(JSON.stringify(result)).not.toContain("private-password");
  });
});
