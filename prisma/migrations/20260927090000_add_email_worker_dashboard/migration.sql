-- Additive monitoring and metadata only. Existing jobs/history are not backfilled.
ALTER TABLE "email_deliveries" ADD COLUMN "context_snapshot" JSONB;
ALTER TABLE "email_delivery_attempts"
  ADD COLUMN "context_snapshot" JSONB,
  ADD COLUMN "worker_run_id" TEXT;

CREATE INDEX "email_deliveries_accepted_at_idx" ON "email_deliveries"("accepted_at");

CREATE TABLE "email_worker_runs" (
  "id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_progress_at" TIMESTAMP(3),
  "current_delivery_id" TEXT,
  "last_error_code" TEXT,
  "last_error_at" TIMESTAMP(3),
  "stopping_at" TIMESTAMP(3),
  "stopped_at" TIMESTAMP(3),
  CONSTRAINT "email_worker_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_worker_runs_last_heartbeat_at_idx" ON "email_worker_runs"("last_heartbeat_at");
CREATE INDEX "email_worker_runs_started_at_idx" ON "email_worker_runs"("started_at");
