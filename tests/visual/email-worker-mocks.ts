import type { EmailDashboardFilter, EmailDeliveryDetail, EmailDeliveryListItem } from "@/lib/domains/email-delivery/dashboard-types";
import { emailContextFixture, emailDetailFixture, emailFixtureTime, emailOverviewFixture, emailPageFixture } from "../fixtures/email-worker";

// Synthetic data only. Every dashboard action resolves in memory; no database or SMTP is loaded.
const rows: EmailDeliveryDetail[] = [
  emailDetailFixture(),
  emailDetailFixture({ id: "accepted-fixture", expenseClaimId: "claim-accepted-fixture", leaderName: "หัวหน้า ฝ่ายปฏิบัติการ", claimantName: "ผู้ยื่น ฝ่ายปฏิบัติการ", recipientEmail: "leader.accepted@example.test", status: "ACCEPTED", attemptCount: 1, cycleAttemptCount: 1, acceptedAt: emailFixtureTime, lastErrorCode: null, canRetry: false, attempts: emailPageFixture([{ ...emailDetailFixture().attempts.data[0], id: "accepted-attempt", attemptNumber: 1, recipientEmail: "leader.accepted@example.test", outcome: "ACCEPTED", errorCode: null }]) }),
  emailDetailFixture({ id: "legacy-fixture", expenseClaimId: "claim-legacy-fixture", contextSnapshot: null, contextSource: "CURRENT", status: "SKIPPED", attemptCount: 1, cycleAttemptCount: 1, lastErrorCode: "NO_PENDING_VERIFICATIONS", canRetry: false, currentContext: { ...emailContextFixture, eligibility: { kind: "skipped", code: "NO_PENDING_VERIFICATIONS" }, orders: [{ ...emailContextFixture.orders[0], state: "MISSING" }] } }),
];

export async function getEmailWorkerOverview() {
  return { success: true, data: structuredClone({ ...emailOverviewFixture, oldestReadyAt: new Date("2026-09-26T04:15:00Z"), expiredLeaseCount: 1, processingCount: 2, workers: [
    ...emailOverviewFixture.workers,
    { ...emailOverviewFixture.workers[0], id: "worker-stalled-fixture", state: "STALLED", currentDeliveryId: null, lastErrorCode: "WORKER_RUNTIME_FAILED", lastErrorAt: emailFixtureTime },
  ] }) };
}

export async function listEmailWorkerJobs(filters: EmailDashboardFilter = {}) {
  const search = filters.search?.toLowerCase() || "";
  const filtered = rows.filter((row) => {
    const date = row.createdAt.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    return (!filters.status || row.status === filters.status) && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to) &&
      (!search || [row.id, row.expenseClaimId, row.recipientEmail, row.claimantName, row.leaderName].some((value) => value?.toLowerCase().includes(search)));
  });
  const page = filters.page || 1;
  const list: EmailDeliveryListItem[] = filtered.slice((page - 1) * 25, page * 25).map((row) => ({
    id: row.id, kind: row.kind, expenseClaimId: row.expenseClaimId, leaderUserId: row.leaderUserId, recipientEmail: row.recipientEmail,
    claimantName: row.claimantName, leaderName: row.leaderName, expenseMonth: row.expenseMonth, contextSource: row.contextSource,
    status: row.status, attemptCount: row.attemptCount, cycleAttemptCount: row.cycleAttemptCount, createdAt: row.createdAt, updatedAt: row.updatedAt,
    acceptedAt: row.acceptedAt, nextAttemptAt: row.nextAttemptAt, lastErrorCode: row.lastErrorCode,
  }));
  return { success: true, data: structuredClone(emailPageFixture(list, page, filtered.length)) };
}

export async function getEmailWorkerJob(id: string, attemptPage = 1) {
  const row = rows.find((item) => item.id === id);
  if (!row) return { success: false, error: "ไม่พบงานตัวอย่าง", code: "NOT_FOUND" };
  return { success: true, data: structuredClone({ ...row, attempts: emailPageFixture(row.attempts.data.slice((attemptPage - 1) * 25, attemptPage * 25), attemptPage, row.attempts.data.length) }) };
}

export async function retryEmailDelivery(id: string) {
  const row = rows.find((item) => item.id === id);
  if (!row || row.status !== "FAILED" || !row.canRetry) return { success: false, error: "งานตัวอย่างนี้ไม่พร้อมลองใหม่", code: "VALIDATION_ERROR" };
  row.status = "PENDING";
  row.canRetry = false;
  row.cycleAttemptCount = 0;
  row.nextAttemptAt = emailFixtureTime;
  row.lastErrorCode = null;
  row.attempts.data.unshift({ id: "manual-retry-fixture", attemptNumber: 0, recipientEmail: row.recipientEmail, startedAt: emailFixtureTime, finishedAt: emailFixtureTime, outcome: "MANUAL_RETRY", errorCode: null, messageId: null, requestedById: "admin-fixture", requestedByName: "ผู้ดูแล ตัวอย่าง", workerRunId: null, contextSnapshot: row.currentContext });
  return { success: true, data: undefined };
}
