-- No backfill: only future verification generations enqueue internal email.
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY_WAIT', 'ACCEPTED', 'FAILED', 'SKIPPED');

CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INTERNAL_LEADER_VERIFY',
    "dedupe_key" TEXT NOT NULL,
    "expense_claim_id" TEXT NOT NULL,
    "leader_user_id" TEXT NOT NULL,
    "verification_ids" TEXT[],
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipient_email" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "cycle_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "message_id" TEXT,
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_delivery_attempts" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "recipient_email" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "outcome" TEXT,
    "error_code" TEXT,
    "message_id" TEXT,
    "requested_by_id" TEXT,
    CONSTRAINT "email_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_deliveries_dedupe_key_key" ON "email_deliveries"("dedupe_key");
CREATE INDEX "email_deliveries_status_next_attempt_at_idx" ON "email_deliveries"("status", "next_attempt_at");
CREATE INDEX "email_deliveries_status_lease_expires_at_idx" ON "email_deliveries"("status", "lease_expires_at");
CREATE INDEX "email_deliveries_expense_claim_id_idx" ON "email_deliveries"("expense_claim_id");
CREATE INDEX "email_deliveries_leader_user_id_idx" ON "email_deliveries"("leader_user_id");
CREATE INDEX "email_deliveries_created_at_idx" ON "email_deliveries"("created_at");
CREATE INDEX "email_delivery_attempts_delivery_id_started_at_idx" ON "email_delivery_attempts"("delivery_id", "started_at");
ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_delivery_id_fkey"
    FOREIGN KEY ("delivery_id") REFERENCES "email_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
