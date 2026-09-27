import type { EmailAttemptView, EmailDashboardFilter, EmailDeliveryDetail, EmailDeliveryListItem, EmailWorkerOverview, EmailWorkerRunView } from "@/lib/domains/email-delivery/dashboard-types";
import { emailContextFixture, emailDetailFixture, emailFixtureTime, emailOverviewFixture, emailPageFixture } from "../fixtures/email-worker";

// Synthetic data only. Every dashboard action resolves in memory; no database or SMTP is loaded.
const scenario = new URLSearchParams(window.location.search).get("scenario") ?? "normal";
const minutesBefore = (minutes: number) => new Date(emailFixtureTime.getTime() - minutes * 60_000);
const minutesAfter = (minutes: number) => new Date(emailFixtureTime.getTime() + minutes * 60_000);
const failed = () => emailDetailFixture();
const pending = () => emailDetailFixture({ id: "pending-fixture", expenseClaimId: "claim-pending-fixture", claimantName: "วิภา ใจดี", leaderName: "สมชาย ดูแลกิจการ", recipientEmail: "somchai@example.test", status: "PENDING", attemptCount: 0, cycleAttemptCount: 0, lastErrorCode: null, nextAttemptAt: minutesBefore(2), canRetry: false, attempts: emailPageFixture([]) });
const processing = () => emailDetailFixture({ id: "processing-fixture", expenseClaimId: "claim-processing-fixture", claimantName: "กิตติ ทำงานดี", leaderName: "อารีย์ ตั้งใจ", recipientEmail: "aree@example.test", status: "PROCESSING", attemptCount: 1, cycleAttemptCount: 1, lastErrorCode: null, leaseExpiresAt: minutesAfter(2), canRetry: false, attempts: emailPageFixture([{ ...emailDetailFixture().attempts.data[0], id: "processing-attempt", attemptNumber: 1, outcome: null, finishedAt: null, errorCode: null }]) });
const retry = () => emailDetailFixture({ id: "retry-fixture", expenseClaimId: "claim-retry-fixture", claimantName: "สุภาวดี รักษางาน", leaderName: "ธนา ตั้งมั่น", recipientEmail: "thana@example.test", status: "RETRY_WAIT", attemptCount: 2, cycleAttemptCount: 2, nextAttemptAt: minutesAfter(5), lastErrorCode: "SMTP_CONNECTION_FAILED", canRetry: false, attempts: emailPageFixture([{ ...emailDetailFixture().attempts.data[0], id: "retry-attempt", attemptNumber: 2, outcome: "RETRY_WAIT", errorCode: "SMTP_CONNECTION_FAILED" }]) });
const accepted = (id = "accepted-fixture") => emailDetailFixture({ id, expenseClaimId: "claim-accepted-fixture", leaderName: "หัวหน้า ฝ่ายปฏิบัติการ", claimantName: "ผู้ยื่น ฝ่ายปฏิบัติการ", recipientEmail: "leader.accepted@example.test", status: "ACCEPTED", attemptCount: 1, cycleAttemptCount: 1, acceptedAt: emailFixtureTime, lastErrorCode: null, canRetry: false, attempts: emailPageFixture([{ ...emailDetailFixture().attempts.data[0], id: "accepted-attempt", attemptNumber: 1, recipientEmail: "leader.accepted@example.test", outcome: "ACCEPTED", errorCode: null, messageId: "<accepted-fixture@sraw.example.test>" }]) });
const legacy = (id = "legacy-fixture") => emailDetailFixture({ id, expenseClaimId: "claim-legacy-fixture", contextSnapshot: null, contextSource: "CURRENT", status: "SKIPPED", attemptCount: 1, cycleAttemptCount: 1, lastErrorCode: "NO_PENDING_VERIFICATIONS", canRetry: false, currentContext: { ...emailContextFixture, eligibility: { kind: "skipped", code: "NO_PENDING_VERIFICATIONS" }, orders: [{ ...emailContextFixture.orders[0], state: "MISSING" }] }, attempts: emailPageFixture([{ ...emailDetailFixture().attempts.data[0], id: "legacy-attempt", attemptNumber: 1, outcome: "SKIPPED", errorCode: "NO_PENDING_VERIFICATIONS", contextSnapshot: null, workerRunId: null }]) });

function scenarioRows(): EmailDeliveryDetail[] {
  if (scenario === "all-statuses") return [failed(), pending(), processing(), retry(), accepted(), legacy()];
  if (scenario === "issues") return [failed(), processing(), retry(), accepted(), legacy()];
  if (scenario === "legacy") return [legacy("delivery-fixture")];
  if (scenario === "long-content") {
    const longName = "นางสาวพิชชาภา อภิมหาจิตรพัฒนไพศาลวัฒนกุล ผู้ประสานงานปฏิบัติการภูมิภาคตะวันออกเฉียงเหนือ";
    const longEmail = "operational.supervisor.northeastern-regional-office.long-recipient-name@example.test";
    const context = { ...emailContextFixture, claimantName: longName, leaderName: longName, recipientEmail: longEmail, orders: [{ ...emailContextFixture.orders[0], reference: "คำสั่งปฏิบัติงานในพื้นที่เสี่ยงและพื้นที่ห่างไกลของหน่วยงานปฏิบัติการภูมิภาค เลขที่ 12345678901234567890/2569" }] };
    const longJob = emailDetailFixture({ claimantName: longName, leaderName: longName, recipientEmail: longEmail, expenseClaimId: `claim-${"1234567890".repeat(8)}`, contextSnapshot: context, currentContext: { ...context, recipientEmail: `updated.${longEmail}` }, attempts: emailPageFixture([{ ...emailDetailFixture().attempts.data[0], recipientEmail: longEmail, contextSnapshot: context, workerRunId: `worker-${"1234567890".repeat(8)}`, messageId: `<${"long-message-id".repeat(10)}@example.test>` }]) });
    return [longJob, { ...longJob, id: `delivery-${"1234567890".repeat(8)}`, status: "ACCEPTED", canRetry: false, acceptedAt: emailFixtureTime, lastErrorCode: null }];
  }
  if (scenario === "many-attempts") {
    const attempts: EmailAttemptView[] = Array.from({ length: 26 }, (_, index) => ({
      ...emailDetailFixture().attempts.data[0], id: `attempt-${26 - index}`, attemptNumber: 26 - index,
      recipientEmail: index < 6 ? "latest@example.test" : "former.recipient@example.test",
      startedAt: minutesBefore(index * 5 + 1), finishedAt: minutesBefore(index * 5),
      outcome: index === 0 ? "FAILED" : "RETRY_WAIT", errorCode: index === 0 ? "RETRY_EXHAUSTED" : "SMTP_CONNECTION_FAILED",
    }));
    attempts.splice(6, 0, { id: "manual-retry-history", attemptNumber: 0, recipientEmail: "latest@example.test", startedAt: minutesBefore(28), finishedAt: minutesBefore(28), outcome: "MANUAL_RETRY", errorCode: null, messageId: null, requestedById: "admin-fixture", requestedByName: "ผู้ดูแล ตัวอย่าง", workerRunId: null, contextSnapshot: emailContextFixture });
    return [emailDetailFixture({ attemptCount: 26, cycleAttemptCount: 6, attempts: emailPageFixture(attempts), lastErrorCode: "RETRY_EXHAUSTED" })];
  }
  if (scenario === "no-worker") return [{ ...pending(), id: "delivery-fixture" }];
  return [accepted("delivery-fixture"), pending(), accepted("accepted-second-fixture")];
}
const rows = scenarioRows();

function scenarioWorkers(): EmailWorkerRunView[] {
  const worker = { ...emailOverviewFixture.workers[0], state: "IDLE" as const, currentDeliveryId: null, startedAt: minutesBefore(240) };
  if (scenario === "no-worker") return [];
  if (scenario === "issues" || scenario === "all-statuses") return [
    { ...worker, id: "worker-current-fixture", state: "DEGRADED", currentDeliveryId: "processing-fixture", lastErrorCode: "DATABASE_CONNECTION_FAILED", lastErrorAt: minutesBefore(1), lastProgressAt: minutesBefore(5) },
    { ...worker, id: "worker-stalled-fixture", state: "STALLED", currentDeliveryId: null, lastProgressAt: minutesBefore(3) },
    { ...worker, id: "worker-prior-deployment-fixture", state: "NO_SIGNAL", startedAt: minutesBefore(500), lastHeartbeatAt: minutesBefore(260), lastProgressAt: minutesBefore(260) },
    { ...worker, id: "worker-stopped-fixture", state: "STOPPED", startedAt: minutesBefore(800), stoppingAt: minutesBefore(501), stoppedAt: minutesBefore(500), lastHeartbeatAt: minutesBefore(500), lastProgressAt: minutesBefore(500) },
  ];
  return [worker];
}

export async function getEmailWorkerOverview() {
  const workers = scenarioWorkers();
  const overview: EmailWorkerOverview = {
    ...emailOverviewFixture, readyCount: rows.filter((row) => row.status === "PENDING").length,
    retryWaitCount: rows.filter((row) => row.status === "RETRY_WAIT").length,
    failedCount: rows.filter((row) => row.status === "FAILED").length,
    processingCount: rows.filter((row) => row.status === "PROCESSING").length,
    acceptedLast24HoursCount: rows.filter((row) => row.status === "ACCEPTED").length,
    expiredLeaseCount: scenario === "issues" ? 1 : 0,
    oldestReadyAt: rows.some((row) => row.status === "PENDING") ? minutesBefore(2) : null,
    activeWorkerCount: workers.filter((worker) => !["NO_SIGNAL", "STOPPED"].includes(worker.state)).length, workers,
  };
  return { success: true, data: structuredClone(overview) };
}

export async function listEmailWorkerJobs(filters: EmailDashboardFilter = {}) {
  const search = filters.search?.toLowerCase() || "";
  const filtered = rows.filter((row) => {
    const date = row.createdAt.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    return (!filters.status || row.status === filters.status) && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to) &&
      (!search || [row.id, row.expenseClaimId, row.recipientEmail, row.claimantName, row.leaderName, ...row.attempts.data.map((attempt) => attempt.recipientEmail)].some((value) => value?.toLowerCase().includes(search)));
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
