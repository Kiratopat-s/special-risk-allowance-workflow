import type { EmailContextSnapshot } from "@/lib/domains/email-delivery/snapshots";
import type { EmailDeliveryDetail, EmailDeliveryListItem, EmailWorkerOverview } from "@/lib/domains/email-delivery/dashboard-types";
import type { PaginatedResult } from "@/lib/shared/types";

export const emailFixtureTime = new Date("2026-09-27T06:30:00Z");
export const emailContextFixture: EmailContextSnapshot = {
  version: 1, capturedAt: emailFixtureTime.toISOString(), claimantName: "ผู้ยื่น ตัวอย่าง", leaderName: "หัวหน้า ตัวอย่าง",
  expenseMonth: "2026-09-01T00:00:00Z", recipientEmail: "historical@example.test", claimStatus: "PENDING_LEADER_VERIFY", recipientStatus: "ACTIVE",
  eligibility: { kind: "eligible", code: null },
  orders: [{ verificationId: "verification-fixture", offSiteWorkId: "order-fixture", reference: "คำสั่งที่ 123/2569", expiresAt: "2026-10-03T06:30:00Z", state: "PENDING" }],
};

export function emailJobFixture(overrides: Partial<EmailDeliveryListItem> = {}): EmailDeliveryListItem {
  return {
    id: "delivery-fixture", kind: "INTERNAL_LEADER_VERIFY", expenseClaimId: "claim-fixture", leaderUserId: "leader-fixture",
    recipientEmail: "historical@example.test", claimantName: "ผู้ยื่น ตัวอย่าง", leaderName: "หัวหน้า ตัวอย่าง", expenseMonth: new Date("2026-09-01T00:00:00Z"),
    contextSource: "SNAPSHOT", status: "FAILED", attemptCount: 6, cycleAttemptCount: 6, createdAt: emailFixtureTime,
    updatedAt: emailFixtureTime, acceptedAt: null, nextAttemptAt: null, lastErrorCode: "SMTP_TEMPORARY_REJECTION", ...overrides,
  };
}

export function emailPageFixture<T>(data: T[], page = 1, total = data.length): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / 25));
  return { data, pagination: { page, pageSize: 25, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 } };
}

export function emailDetailFixture(overrides: Partial<EmailDeliveryDetail> = {}): EmailDeliveryDetail {
  return {
    ...emailJobFixture(), verificationIds: ["verification-fixture"], leaseExpiresAt: null, messageId: null, canRetry: true,
    contextSnapshot: { ...emailContextFixture, eligibility: { kind: "queued", code: null } },
    currentContext: { ...emailContextFixture, recipientEmail: "current@example.test" },
    attempts: emailPageFixture([{
      id: "attempt-fixture", attemptNumber: 6, recipientEmail: "historical@example.test", startedAt: emailFixtureTime, finishedAt: emailFixtureTime,
      outcome: "FAILED", errorCode: "SMTP_TEMPORARY_REJECTION", messageId: null, requestedById: null, requestedByName: null,
      workerRunId: "worker-fixture", contextSnapshot: emailContextFixture,
    }]), ...overrides,
  };
}

export const emailOverviewFixture: EmailWorkerOverview = {
  measuredAt: emailFixtureTime, readyCount: 18, processingCount: 1, retryWaitCount: 4, failedCount: 7, acceptedLast24HoursCount: 42,
  expiredLeaseCount: 0, oldestReadyAt: emailFixtureTime, activeWorkerCount: 1,
  workers: [{ id: "worker-fixture", state: "PROCESSING", startedAt: emailFixtureTime, lastHeartbeatAt: emailFixtureTime, lastProgressAt: emailFixtureTime,
    currentDeliveryId: "delivery-fixture", lastErrorCode: null, lastErrorAt: null, stoppingAt: null, stoppedAt: null }],
};
