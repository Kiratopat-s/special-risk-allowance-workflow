import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { EmailSendResult, InternalLeaderEmailInput } from "@/lib/email/internal-leader";
import { createEmailDeliveryRepository } from "./repository";
import { evaluateEmailEligibility } from "./eligibility";
import { EMAIL_RETRY_DELAYS_MS } from "./types";
import { createEmailContextSnapshot } from "./snapshots";

export interface EmailDeliveryWorkerOptions {
  workerRunId?: string;
  onJobStarted?: (id: string) => Promise<void>;
  onJobFinished?: () => Promise<void>;
}

async function observeJob(callback?: () => Promise<void>): Promise<void> {
  if (!callback) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(callback).catch(() => undefined),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, 1_000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function createEmailDeliveryWorkerService(
  client: PrismaClient,
  sendEmail: (input: InternalLeaderEmailInput) => Promise<EmailSendResult>,
  options: EmailDeliveryWorkerOptions = {},
) {
  const repository = createEmailDeliveryRepository(client);
  return {
    async processNext(): Promise<boolean> {
      const job = await repository.claimNext(undefined, { workerRunId: options.workerRunId });
      if (!job) return false;
      let leaseLost = false;
      let renewing: Promise<void> | undefined;
      const heartbeat = setInterval(() => {
        if (renewing || leaseLost) return;
        renewing = repository.renewLease(job.id, job.leaseToken)
          .then((owned) => { if (!owned) leaseLost = true; })
          .catch(() => { leaseLost = true; })
          .finally(() => { renewing = undefined; });
      }, 30_000);
      heartbeat.unref?.();
      try {
        await observeJob(options.onJobStarted ? () => options.onJobStarted!(job.id) : undefined);
        const context = await repository.loadContext(job);
        const evaluatedAt = new Date();
        const eligibility = evaluateEmailEligibility(context, evaluatedAt);
        if (leaseLost) return true;
        const snapshot = createEmailContextSnapshot(context, eligibility, evaluatedAt);
        if (!await repository.prepareAttempt(job, snapshot) || leaseLost) return true;
        if (eligibility.kind !== "eligible") {
          await repository.complete(job, { status: eligibility.kind === "failed" ? "FAILED" : "SKIPPED", code: eligibility.code });
          return true;
        }
        let outcome: EmailSendResult;
        try {
          outcome = await sendEmail({ ...eligibility.content, deliveryId: job.id });
        } catch {
          outcome = { kind: "retryable_error", code: "TRANSPORT_UNEXPECTED" };
        }
        if (leaseLost) return true;
        if (outcome.kind === "accepted") {
          await repository.complete(job, { status: "ACCEPTED", messageId: outcome.messageId });
        } else {
          const delay = EMAIL_RETRY_DELAYS_MS[job.cycleAttemptCount - 1];
          const retry = outcome.kind === "retryable_error" && delay !== undefined;
          await repository.complete(job, {
            status: retry ? "RETRY_WAIT" : "FAILED", code: outcome.code,
            ...(retry ? { nextAttemptAt: new Date(Date.now() + delay) } : {}),
          });
        }
        return true;
      } finally {
        clearInterval(heartbeat);
        await renewing;
        await observeJob(options.onJobFinished);
      }
    },
  };
}
