import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { EmailSendResult, InternalLeaderEmailInput } from "@/lib/email/internal-leader";
import { createEmailDeliveryRepository } from "./repository";
import { evaluateEmailEligibility } from "./eligibility";
import { EMAIL_RETRY_DELAYS_MS } from "./types";

export function createEmailDeliveryWorkerService(
  client: PrismaClient,
  sendEmail: (input: InternalLeaderEmailInput) => Promise<EmailSendResult>,
) {
  const repository = createEmailDeliveryRepository(client);
  return {
    async processNext(): Promise<boolean> {
      const job = await repository.claimNext();
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
        const eligibility = evaluateEmailEligibility(await repository.loadContext(job));
        if (leaseLost) return true;
        if (eligibility.kind !== "eligible") {
          await repository.complete(job, { status: eligibility.kind === "failed" ? "FAILED" : "SKIPPED", code: eligibility.code });
          return true;
        }
        if (!await repository.recordRecipient(job, eligibility.content.to) || leaseLost) return true;
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
      }
    },
  };
}
