import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { EmailSendResult } from "@/lib/email/internal-leader";
import { EMAIL_RETRY_DELAYS_MS } from "./types";

const mock = vi.hoisted(() => ({
  claimNext: vi.fn(), renewLease: vi.fn(), loadContext: vi.fn(), recordRecipient: vi.fn(), complete: vi.fn(),
}));
vi.mock("./repository", () => ({ createEmailDeliveryRepository: () => mock }));
import { createEmailDeliveryWorkerService } from "./worker-service";

const now = new Date("2026-09-26T00:00:00Z");
const job = { id: "delivery-1", leaseToken: "lease-1", attemptId: "attempt-1", cycleAttemptCount: 1 };
const sendEmail = vi.fn<() => Promise<EmailSendResult>>();
const service = createEmailDeliveryWorkerService({} as PrismaClient, sendEmail);
function context() {
  return {
    claim: { status: "PENDING_LEADER_VERIFY", cancelledAt: null, monthlyRequestCollectionId: null,
      expenseMonth: now, claimant: { firstName: "ผู้ยื่น", lastName: "ทดสอบ" },
      expenseClaimOffSiteWorks: [{ offSiteWorkId: "work-1" }, { offSiteWorkId: "work-2" }] },
    leader: { email: "current@example.test", status: "ACTIVE" },
    verifications: [
      { offSiteWorkId: "work-1", verifiedAt: null, expiresAt: new Date("2026-09-27"), offSiteWork: { deletedAt: null, innerRefDocumentId: "REF-1" } },
      { offSiteWorkId: "work-2", verifiedAt: now, expiresAt: new Date("2026-09-27"), offSiteWork: { deletedAt: null, innerRefDocumentId: "REF-2" } },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  mock.claimNext.mockResolvedValue(job);
  mock.loadContext.mockResolvedValue(context());
  mock.recordRecipient.mockResolvedValue(true);
  mock.renewLease.mockResolvedValue(true);
  mock.complete.mockResolvedValue(true);
  sendEmail.mockResolvedValue({ kind: "accepted", messageId: "message-1" });
});
afterEach(() => vi.useRealTimers());

describe("durable email processing", () => {
  it("uses the current account email and sends only remaining pending orders", async () => {
    expect(await service.processNext()).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith({
      deliveryId: "delivery-1", to: "current@example.test", claimantName: "ผู้ยื่น ทดสอบ", expenseMonth: now,
      orders: [{ reference: "REF-1", expiresAt: new Date("2026-09-27") }],
    });
    expect(mock.recordRecipient).toHaveBeenCalledWith(job, "current@example.test");
    expect(mock.complete).toHaveBeenCalledWith(job, { status: "ACCEPTED", messageId: "message-1" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(EMAIL_RETRY_DELAYS_MS.map((delay, index) => ({ delay, cycle: index + 1 })))
    ("schedules bounded backoff after attempt $cycle", async ({ delay, cycle }) => {
      mock.claimNext.mockResolvedValue({ ...job, cycleAttemptCount: cycle });
      sendEmail.mockResolvedValue({ kind: "retryable_error", code: "SMTP_CONNECTION_FAILED" });
      await service.processNext();
      expect(mock.complete).toHaveBeenCalledWith(expect.anything(), {
        status: "RETRY_WAIT", code: "SMTP_CONNECTION_FAILED", nextAttemptAt: new Date(now.getTime() + delay),
      });
    });

  it("fails the sixth transient attempt without adding an unbounded retry", async () => {
    mock.claimNext.mockResolvedValue({ ...job, cycleAttemptCount: 6 });
    sendEmail.mockResolvedValue({ kind: "retryable_error", code: "SMTP_CONNECTION_FAILED" });
    await service.processNext();
    expect(mock.complete).toHaveBeenCalledWith(expect.anything(), { status: "FAILED", code: "SMTP_CONNECTION_FAILED" });
  });

  it.each(["permanent_error", "configuration_error"] as const)("stops on %s", async (kind) => {
    sendEmail.mockResolvedValue({ kind, code: "SAFE_FAILURE" });
    await service.processNext();
    expect(mock.complete).toHaveBeenCalledWith(job, { status: "FAILED", code: "SAFE_FAILURE" });
  });

  it.each(["cancelled", "collected", "verified", "expired", "unlinked", "deleted", "superseded"])("skips %s requests", async (scenario) => {
    const data = context();
    if (scenario === "cancelled") data.claim.status = "CANCELLED";
    if (scenario === "collected") data.claim.status = "COLLECTED";
    if (scenario === "verified") data.verifications[0].verifiedAt = now;
    if (scenario === "expired") data.verifications[0].expiresAt = now;
    if (scenario === "unlinked") data.claim.expenseClaimOffSiteWorks = [];
    if (scenario === "deleted") Object.assign(data.verifications[0].offSiteWork, { deletedAt: now });
    if (scenario === "superseded") data.verifications = [];
    mock.loadContext.mockResolvedValue(data);
    await service.processNext();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mock.complete).toHaveBeenCalledWith(job, expect.objectContaining({ status: "SKIPPED" }));
  });

  it.each(["INACTIVE", "SUSPENDED", "PENDING"])("records non-active recipient %s as failed", async (status) => {
    const data = context();
    data.leader.status = status;
    mock.loadContext.mockResolvedValue(data);
    await service.processNext();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mock.complete).toHaveBeenCalledWith(job, { status: "FAILED", code: "RECIPIENT_INACTIVE" });
  });

  it("rejects invalid recipients without calling SMTP", async () => {
    const data = context();
    data.leader.email = "invalid";
    mock.loadContext.mockResolvedValue(data);
    await service.processNext();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mock.complete).toHaveBeenCalledWith(job, { status: "FAILED", code: "INVALID_RECIPIENT" });
  });

  it("does not send after losing the lease before the recipient is recorded", async () => {
    mock.recordRecipient.mockResolvedValue(false);
    await service.processNext();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mock.complete).not.toHaveBeenCalled();
  });

  it("renews during SMTP and does not commit if ownership is lost", async () => {
    let finish!: (value: EmailSendResult) => void;
    sendEmail.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mock.renewLease.mockResolvedValue(false);
    const processing = service.processNext();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mock.renewLease).toHaveBeenCalledWith(job.id, job.leaseToken);
    finish({ kind: "accepted", messageId: "message-1" });
    await processing;
    expect(mock.complete).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns idle without starting timers when no work is due", async () => {
    mock.claimNext.mockResolvedValue(null);
    expect(await service.processNext()).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
