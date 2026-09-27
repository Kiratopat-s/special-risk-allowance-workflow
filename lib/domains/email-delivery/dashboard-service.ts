import type { EmailDelivery, PrismaClient } from "@/lib/generated/prisma/client";
import { error, success, type Result, type PaginatedResult } from "@/lib/shared/types";
import { createEmailDashboardRepository } from "./dashboard-repository";
import { validateDashboardFilter, validDeliveryId, safeEmailErrorCode, safeEmailMessageId } from "./dashboard-validation";
import { createEmailContextSnapshot, parseSnapshot, type EmailContextSnapshot } from "./snapshots";
import { evaluateEmailEligibility } from "./eligibility";
import { deriveWorkerState } from "./worker-monitor";
import type { EmailAttemptView, EmailDashboardFilter, EmailDeliveryDetail, EmailDeliveryListItem, EmailWorkerOverview } from "./dashboard-types";

function safeSnapshot(value: unknown): EmailContextSnapshot | null {
  const snapshot = parseSnapshot(value);
  return snapshot ? { ...snapshot, eligibility: { ...snapshot.eligibility, code: safeEmailErrorCode(snapshot.eligibility.code) } } : null;
}

function displayName(user: { firstName: string; lastName: string } | null | undefined): string | null {
  return user ? `${user.firstName} ${user.lastName}`.trim() || null : null;
}

function listItem(row: EmailDelivery, current: { claimantName: string | null; leaderName: string | null; expenseMonth: Date | null }): EmailDeliveryListItem {
  const snapshot = safeSnapshot(row.contextSnapshot);
  return {
    id: row.id, kind: row.kind === "INTERNAL_LEADER_VERIFY" ? row.kind : "UNKNOWN",
    expenseClaimId: row.expenseClaimId, leaderUserId: row.leaderUserId, recipientEmail: row.recipientEmail,
    claimantName: snapshot ? snapshot.claimantName : current.claimantName,
    leaderName: snapshot ? snapshot.leaderName : current.leaderName,
    expenseMonth: snapshot ? snapshot.expenseMonth ? new Date(snapshot.expenseMonth) : null : current.expenseMonth,
    contextSource: snapshot ? "SNAPSHOT" : current.claimantName || current.leaderName ? "CURRENT" : "UNAVAILABLE",
    status: row.status, attemptCount: row.attemptCount, cycleAttemptCount: row.cycleAttemptCount,
    createdAt: row.createdAt, updatedAt: row.updatedAt, acceptedAt: row.acceptedAt,
    nextAttemptAt: row.nextAttemptAt, lastErrorCode: safeEmailErrorCode(row.lastErrorCode),
  };
}

const outcomes = new Set(["ACCEPTED", "RETRY_WAIT", "FAILED", "SKIPPED", "INTERRUPTED", "MANUAL_RETRY"]);

export function createEmailDashboardService(client: PrismaClient) {
  const repository = createEmailDashboardRepository(client);
  return {
    async list(filter: EmailDashboardFilter = {}): Promise<Result<PaginatedResult<EmailDeliveryListItem>>> {
      const validated = validateDashboardFilter(filter);
      if (!validated.success) return validated;
      try {
        const result = await repository.list(validated.data);
        const claims = new Map(result.claims.map((claim) => [claim.id, claim]));
        const leaders = new Map(result.leaders.map((leader) => [leader.id, leader]));
        return success({ data: result.rows.map((row) => {
          const claim = claims.get(row.expenseClaimId);
          return listItem(row, { claimantName: displayName(claim?.claimant),
            leaderName: displayName(leaders.get(row.leaderUserId)), expenseMonth: claim?.expenseMonth ?? null });
        }), pagination: result.pagination });
      } catch {
        return error("ไม่สามารถโหลดรายการงานอีเมลได้", "EMAIL_HISTORY_UNAVAILABLE");
      }
    },

    async detail(id: string, attemptPage = 1): Promise<Result<EmailDeliveryDetail>> {
      if (!validDeliveryId(id) || !Number.isSafeInteger(attemptPage) || attemptPage < 1) {
        return error("ข้อมูลรายการอีเมลไม่ถูกต้อง", "VALIDATION_ERROR");
      }
      try {
        const result = await repository.detail(id.trim(), attemptPage);
        if (!result) return error("ไม่พบงานอีเมลนี้", "EMAIL_NOT_FOUND");
        const { row, context, measuredAt } = result;
        const eligibility = evaluateEmailEligibility(context, measuredAt);
        const actors = new Map(result.actors.map((actor) => [actor.id, displayName(actor)]));
        return success({
          ...listItem(row, { claimantName: displayName(context.claim?.claimant),
            leaderName: displayName(context.leader), expenseMonth: context.claim?.expenseMonth ?? null }),
          verificationIds: row.verificationIds, leaseExpiresAt: row.leaseExpiresAt,
          messageId: safeEmailMessageId(row.messageId), canRetry: row.status === "FAILED" && eligibility.kind === "eligible",
          contextSnapshot: safeSnapshot(row.contextSnapshot),
          currentContext: createEmailContextSnapshot(context, eligibility, measuredAt),
          attempts: { pagination: result.pagination, data: result.attempts.map((attempt): EmailAttemptView => ({
            id: attempt.id, attemptNumber: attempt.attemptNumber, recipientEmail: attempt.recipientEmail,
            startedAt: attempt.startedAt, finishedAt: attempt.finishedAt,
            outcome: attempt.outcome === null ? null : outcomes.has(attempt.outcome) ? attempt.outcome as EmailAttemptView["outcome"] : "UNKNOWN",
            errorCode: safeEmailErrorCode(attempt.errorCode), messageId: safeEmailMessageId(attempt.messageId),
            requestedById: attempt.requestedById, requestedByName: attempt.requestedById ? actors.get(attempt.requestedById) ?? null : null,
            workerRunId: attempt.workerRunId, contextSnapshot: safeSnapshot(attempt.contextSnapshot),
          })) },
        });
      } catch {
        return error("ไม่สามารถโหลดรายละเอียดงานอีเมลได้", "EMAIL_DETAIL_UNAVAILABLE");
      }
    },

    async overview(): Promise<Result<EmailWorkerOverview>> {
      try {
        const result = await repository.overview();
        return success({ ...result, workers: result.workers.map((run) => ({
          id: run.id, state: deriveWorkerState(run, result.measuredAt), startedAt: run.startedAt,
          lastHeartbeatAt: run.lastHeartbeatAt, lastProgressAt: run.lastProgressAt,
          currentDeliveryId: run.currentDeliveryId, lastErrorCode: safeEmailErrorCode(run.lastErrorCode),
          lastErrorAt: run.lastErrorAt, stoppingAt: run.stoppingAt, stoppedAt: run.stoppedAt,
        })) });
      } catch {
        return error("ไม่สามารถโหลดสถานะ worker ได้ ข้อมูลที่แสดงอาจไม่เป็นปัจจุบัน", "EMAIL_WORKER_UNAVAILABLE");
      }
    },
  };
}
