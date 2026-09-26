import type { EmailDelivery, EmailDeliveryStatus } from "@/lib/generated/prisma/client";

export type { EmailDeliveryStatus };
export const EMAIL_DELIVERY_STATUSES = ["PENDING", "PROCESSING", "RETRY_WAIT", "ACCEPTED", "FAILED", "SKIPPED"] as const;
export const EMAIL_RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000] as const;
export const EMAIL_LEASE_MS = 120_000;

export interface EmailDeliveryFilter {
  page?: number;
  status?: EmailDeliveryStatus;
  search?: string;
}

export interface EmailDeliveryView {
  id: string;
  expenseClaimId: string;
  leaderUserId: string;
  recipientEmail: string | null;
  status: EmailDeliveryStatus;
  attemptCount: number;
  createdAt: Date;
  acceptedAt: Date | null;
  nextAttemptAt: Date | null;
  lastErrorCode: string | null;
  canRetry: boolean;
  attempts: {
    id: string;
    attemptNumber: number;
    recipientEmail: string | null;
    startedAt: Date;
    finishedAt: Date | null;
    outcome: string | null;
    errorCode: string | null;
    requestedById: string | null;
  }[];
}

export type LeasedEmailDelivery = EmailDelivery & { leaseToken: string; attemptId: string };

export type EmailDeliveryCompletion = {
  status: "ACCEPTED" | "RETRY_WAIT" | "FAILED" | "SKIPPED";
  code?: string;
  messageId?: string;
  nextAttemptAt?: Date;
};
