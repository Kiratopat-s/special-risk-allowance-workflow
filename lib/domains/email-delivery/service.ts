import type { PrismaClient } from "@/lib/generated/prisma/client";
import { error, success, type PaginatedResult, type Result } from "@/lib/shared/types";
import { createEmailDeliveryRepository } from "./repository";
import { evaluateEmailEligibility } from "./eligibility";
import { EMAIL_DELIVERY_STATUSES, type EmailDeliveryFilter, type EmailDeliveryView } from "./types";

export function createEmailDeliveryService(client: PrismaClient) {
  const repository = createEmailDeliveryRepository(client);
  return {
    async list(filter: EmailDeliveryFilter = {}): Promise<Result<PaginatedResult<EmailDeliveryView>>> {
      if ((filter.page !== undefined && (!Number.isSafeInteger(filter.page) || filter.page < 1)) ||
          (filter.status !== undefined && !EMAIL_DELIVERY_STATUSES.includes(filter.status))) {
        return error("ตัวกรองประวัติอีเมลไม่ถูกต้อง", "INVALID_FILTER");
      }
      try {
        const page = await repository.list(filter);
        const data = await Promise.all(page.data.map(async (row): Promise<EmailDeliveryView> => ({
          id: row.id, expenseClaimId: row.expenseClaimId, leaderUserId: row.leaderUserId,
          recipientEmail: row.recipientEmail, status: row.status, attemptCount: row.attemptCount,
          createdAt: row.createdAt, acceptedAt: row.acceptedAt, nextAttemptAt: row.nextAttemptAt, lastErrorCode: row.lastErrorCode,
          canRetry: row.status === "FAILED" && evaluateEmailEligibility(await repository.loadContext(row)).kind === "eligible",
          attempts: row.attempts.map((attempt) => ({
            id: attempt.id, attemptNumber: attempt.attemptNumber, recipientEmail: attempt.recipientEmail,
            startedAt: attempt.startedAt, finishedAt: attempt.finishedAt, outcome: attempt.outcome,
            errorCode: attempt.errorCode, requestedById: attempt.requestedById,
          })),
        })));
        return success({ data, pagination: page.pagination });
      } catch {
        return error("ไม่สามารถโหลดประวัติอีเมลได้", "EMAIL_HISTORY_UNAVAILABLE");
      }
    },
    async retry(id: string, actorId: string): Promise<Result<void>> {
      if (!id || !actorId) return error("ข้อมูลไม่ถูกต้อง", "INVALID_INPUT");
      try {
        const result = await repository.retryFailed(id, actorId, (context) => evaluateEmailEligibility(context).kind === "eligible");
        if (result === "not_failed") return error("รายการนี้ไม่อยู่ในสถานะส่งล้มเหลว หรือถูกจัดคิวใหม่แล้ว", "EMAIL_NOT_FAILED");
        if (result === "ineligible") return error("คำขอหมดอายุ ไม่รอยืนยันแล้ว หรือข้อมูลผู้รับยังไม่พร้อม", "EMAIL_NOT_ELIGIBLE");
        return success(undefined);
      } catch {
        return error("ไม่สามารถจัดคิวอีเมลใหม่ได้", "EMAIL_RETRY_FAILED");
      }
    },
  };
}
