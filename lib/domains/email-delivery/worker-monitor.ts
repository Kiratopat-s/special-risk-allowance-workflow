import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";

export type EmailWorkerState = "STARTING" | "IDLE" | "PROCESSING" | "DEGRADED" | "STALLED" | "STOPPING" | "STOPPED" | "NO_SIGNAL";

export interface EmailWorkerRunTelemetry {
  startedAt: Date;
  lastHeartbeatAt: Date;
  lastProgressAt: Date | null;
  currentDeliveryId: string | null;
  lastErrorCode: string | null;
  lastErrorAt: Date | null;
  stoppingAt: Date | null;
  stoppedAt: Date | null;
}

export const EMAIL_WORKER_SIGNAL_THRESHOLD_MS = 90_000;

/** Both timestamps are measured by PostgreSQL, avoiding host clock differences. */
export function deriveWorkerState(run: EmailWorkerRunTelemetry | null, measuredAt: Date): EmailWorkerState {
  if (!run) return "NO_SIGNAL";
  if (run.stoppedAt) return "STOPPED";
  if (measuredAt.getTime() - run.lastHeartbeatAt.getTime() > EMAIL_WORKER_SIGNAL_THRESHOLD_MS) return "NO_SIGNAL";
  if (run.stoppingAt) return "STOPPING";
  if (run.lastErrorCode && run.lastErrorAt && (!run.lastProgressAt || run.lastErrorAt > run.lastProgressAt)) return "DEGRADED";
  if (measuredAt.getTime() - (run.lastProgressAt ?? run.startedAt).getTime() > EMAIL_WORKER_SIGNAL_THRESHOLD_MS) return "STALLED";
  if (!run.lastProgressAt && !run.currentDeliveryId) return "STARTING";
  return run.currentDeliveryId ? "PROCESSING" : "IDLE";
}

const errorCodes = ["DELIVERY_PROCESSING_FAILED", "DATABASE_CONNECTION_FAILED", "HEALTH_SERVER_FAILED", "WORKER_RUNTIME_FAILED", "SHUTDOWN_DELIVERY_TIMEOUT"] as const;
export type EmailWorkerErrorCode = typeof errorCodes[number];
type MonitorEvent = "start" | "heartbeat" | "progress" | "failure" | "jobStarted" | "jobFinished" | "stopping" | "stopped";

/** Telemetry is independent of delivery state: failures never escape to the caller. */
export function createEmailWorkerMonitor(client: Pick<PrismaClient, "$executeRaw">, runId: string) {
  const started = performance.now();
  let pending = Promise.resolve();
  let queued = 0;
  let failureReported = false;

  function record(event: MonitorEvent, value?: string): Promise<void> {
    // A stuck database statement must not create an unbounded telemetry backlog.
    if (queued >= 32) return Promise.resolve();
    queued++;
    const operation = pending.then(async () => {
      const now = Prisma.sql`CURRENT_TIMESTAMP`;
      const isProgress = event === "progress";
      const errorCode = event === "failure"
        ? errorCodes.find((code) => code === value) ?? "WORKER_RUNTIME_FAILED" : null;
      const currentDeliveryId = event === "jobStarted" ? value ?? null : null;
      const changes: Record<MonitorEvent, Prisma.Sql> = {
        start: Prisma.sql`"last_heartbeat_at" = ${now}`,
        heartbeat: Prisma.sql`"last_heartbeat_at" = ${now}`,
        progress: Prisma.sql`"last_progress_at" = ${now}, "current_delivery_id" = NULL`,
        failure: Prisma.sql`"last_error_code" = ${errorCode}, "last_error_at" = ${now}`,
        jobStarted: Prisma.sql`"current_delivery_id" = ${currentDeliveryId}`,
        jobFinished: Prisma.sql`"current_delivery_id" = NULL`,
        stopping: Prisma.sql`"stopping_at" = COALESCE("email_worker_runs"."stopping_at", ${now})`,
        stopped: Prisma.sql`"stopped_at" = ${now}, "current_delivery_id" = NULL`,
      };
      await client.$executeRaw(Prisma.sql`
        INSERT INTO "email_worker_runs"
          ("id", "started_at", "last_heartbeat_at", "last_progress_at", "current_delivery_id",
           "last_error_code", "last_error_at", "stopping_at", "stopped_at")
        VALUES (${runId}, ${now} - (${Math.max(0, performance.now() - started)} * INTERVAL '1 millisecond'),
          ${now}, ${isProgress ? now : null}, ${currentDeliveryId}, ${errorCode}, ${errorCode ? now : null},
          ${event === "stopping" ? now : null}, ${event === "stopped" ? now : null})
        ON CONFLICT ("id") DO UPDATE SET ${changes[event]}
        WHERE "email_worker_runs"."stopped_at" IS NULL
      `);
      failureReported = false;
    }).catch(() => {
      if (!failureReported) console.error("[email-worker] WORKER_MONITOR_WRITE_FAILED");
      failureReported = true;
    }).finally(() => { queued--; });
    // Preserve event order even when a hook's caller stops waiting after its deadline.
    pending = operation;
    return operation;
  }

  return {
    start: () => record("start"),
    heartbeat: () => record("heartbeat"),
    progress: () => record("progress"),
    failure: (code: EmailWorkerErrorCode) => record("failure", code),
    jobStarted: (id: string) => record("jobStarted", id),
    jobFinished: () => record("jobFinished"),
    stopping: () => record("stopping"),
    stopped: () => record("stopped"),
  };
}
