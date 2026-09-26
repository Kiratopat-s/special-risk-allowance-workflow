import type { EmailDeliveryFilter, EmailDeliveryView } from "@/lib/domains/email-delivery/types";

// All recipients and identifiers are synthetic. Retry only changes this in-memory fixture.
const fixtureTime = new Date("2026-09-26T06:30:00Z");
const rows: EmailDeliveryView[] = [
  {
    id: "email-fixture-accepted", expenseClaimId: "01997f29-8188-7338-93de-000000000001", leaderUserId: "หัวหน้าหน่วยงานตัวอย่าง-01",
    recipientEmail: "leader.accepted@example.test", status: "ACCEPTED", attemptCount: 1, createdAt: fixtureTime,
    acceptedAt: new Date("2026-09-26T06:30:10Z"), nextAttemptAt: null, lastErrorCode: null, canRetry: false,
    attempts: [{ id: "attempt-fixture-accepted", attemptNumber: 1, recipientEmail: "leader.accepted@example.test", startedAt: fixtureTime, finishedAt: new Date("2026-09-26T06:30:10Z"), outcome: "ACCEPTED", errorCode: null, requestedById: null }],
  },
  {
    id: "email-fixture-failed", expenseClaimId: "01997f29-8188-7338-93de-000000000002", leaderUserId: "หัวหน้าหน่วยงานตัวอย่าง-02",
    recipientEmail: "leader.failed-with-long-address@example.test", status: "FAILED", attemptCount: 6, createdAt: fixtureTime,
    acceptedAt: null, nextAttemptAt: null, lastErrorCode: "SMTP_TEMPORARY_REJECTION", canRetry: true,
    attempts: [{ id: "attempt-fixture-failed", attemptNumber: 6, recipientEmail: "leader.failed-with-long-address@example.test", startedAt: fixtureTime, finishedAt: new Date("2026-09-26T06:31:00Z"), outcome: "FAILED", errorCode: "SMTP_TEMPORARY_REJECTION", requestedById: null }],
  },
  {
    id: "email-fixture-obsolete", expenseClaimId: "01997f29-8188-7338-93de-000000000003", leaderUserId: "หัวหน้าหน่วยงานตัวอย่าง-03",
    recipientEmail: "leader.expired@example.test", status: "FAILED", attemptCount: 1, createdAt: fixtureTime,
    acceptedAt: null, nextAttemptAt: null, lastErrorCode: "INVALID_RECIPIENT", canRetry: false, attempts: [],
  },
];

export async function listEmailDeliveries(filters: EmailDeliveryFilter = {}) {
  const search = filters.search?.toLowerCase() ?? "";
  const filtered = rows.filter((row) => (!filters.status || row.status === filters.status) &&
    (!search || row.expenseClaimId.includes(search) || row.recipientEmail?.toLowerCase().includes(search)));
  const page = filters.page ?? 1;
  const pageSize = 2;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  return { success: true, data: { data: structuredClone(filtered.slice((page - 1) * pageSize, page * pageSize)), pagination: {
    page, pageSize, total: filtered.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages,
  } } };
}

export async function retryEmailDelivery(id: string) {
  const row = rows.find((item) => item.id === id);
  if (!row || row.status !== "FAILED" || !row.canRetry) return { success: false, error: "ข้อมูลตัวอย่างนี้ไม่พร้อมลองใหม่" };
  row.status = "PENDING";
  row.canRetry = false;
  row.nextAttemptAt = fixtureTime;
  row.lastErrorCode = null;
  row.attempts.push({ id: "attempt-fixture-manual", attemptNumber: 0, recipientEmail: row.recipientEmail, startedAt: fixtureTime, finishedAt: fixtureTime, outcome: "MANUAL_RETRY", errorCode: null, requestedById: "ผู้ดูแลตัวอย่าง" });
  return { success: true, data: undefined };
}

export async function sendSystemNotification() {
  return { success: false, error: "ข้อมูลจำลอง: ปิดการส่งการแจ้งเตือนจริง" };
}
