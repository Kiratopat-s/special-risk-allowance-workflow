import type { PaginatedResult } from "@/lib/shared/types";
import type { EmailDeliveryFilter, EmailDeliveryStatus } from "./types";
import type { EmailContextSnapshot } from "./snapshots";
import type { EmailWorkerState } from "./worker-monitor";

export interface EmailDashboardFilter extends EmailDeliveryFilter {
  /** Inclusive calendar dates in Asia/Bangkok, YYYY-MM-DD. */
  from?: string;
  to?: string;
}

export interface EmailDeliveryListItem {
  id: string;
  kind: string;
  expenseClaimId: string;
  leaderUserId: string;
  recipientEmail: string | null;
  claimantName: string | null;
  leaderName: string | null;
  expenseMonth: Date | null;
  contextSource: "SNAPSHOT" | "CURRENT" | "UNAVAILABLE";
  status: EmailDeliveryStatus;
  attemptCount: number;
  cycleAttemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  nextAttemptAt: Date | null;
  lastErrorCode: string | null;
}

export interface EmailAttemptView {
  id: string;
  attemptNumber: number;
  recipientEmail: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  outcome: "ACCEPTED" | "RETRY_WAIT" | "FAILED" | "SKIPPED" | "INTERRUPTED" | "MANUAL_RETRY" | "UNKNOWN" | null;
  errorCode: string | null;
  messageId: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  workerRunId: string | null;
  contextSnapshot: EmailContextSnapshot | null;
}

export interface EmailDeliveryDetail extends EmailDeliveryListItem {
  verificationIds: string[];
  leaseExpiresAt: Date | null;
  messageId: string | null;
  canRetry: boolean;
  contextSnapshot: EmailContextSnapshot | null;
  currentContext: EmailContextSnapshot;
  attempts: PaginatedResult<EmailAttemptView>;
}

export interface EmailWorkerRunView {
  id: string;
  state: EmailWorkerState;
  startedAt: Date;
  lastHeartbeatAt: Date;
  lastProgressAt: Date | null;
  currentDeliveryId: string | null;
  lastErrorCode: string | null;
  lastErrorAt: Date | null;
  stoppingAt: Date | null;
  stoppedAt: Date | null;
}

export interface EmailWorkerOverview {
  measuredAt: Date;
  readyCount: number;
  processingCount: number;
  retryWaitCount: number;
  failedCount: number;
  acceptedLast24HoursCount: number;
  expiredLeaseCount: number;
  oldestReadyAt: Date | null;
  activeWorkerCount: number;
  workers: EmailWorkerRunView[];
}
