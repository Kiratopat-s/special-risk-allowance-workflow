import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { sendInternalLeaderEmail, validateInternalEmailConfiguration } from "@/lib/email/internal-leader";
import {
  EmailWorkerConfigurationError,
  emailWorkerConfigurationMessages,
  type EmailWorkerConfigurationIssue,
} from "@/lib/email/configuration-error";

interface DeliveryProcessor {
  processNext(): Promise<boolean>;
}

const idleDelayMs = 15_000;
const healthThresholdMs = 90_000;
const shutdownGraceMs = 60_000;

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
  });
}

/** Sequential processing allows shutdown to finish just the already leased job. */
export async function runDeliveryLoop(
  processor: DeliveryProcessor,
  signal: AbortSignal,
  onProgress: () => void,
  onError: () => void = () => {},
): Promise<void> {
  while (!signal.aborted) {
    try {
      const processed = await processor.processNext();
      onProgress();
      if (processed) continue;
    } catch {
      // No connection strings, email addresses, SMTP responses or tokens in logs.
      console.error("[email-worker] DELIVERY_PROCESSING_FAILED");
      onError();
    }
    await pause(idleDelayMs, signal);
  }
}

/** A separate heartbeat remains live while a delivery or queue poll is stalled. */
export function startWorkerHeartbeat(heartbeat: () => Promise<void>, signal: AbortSignal): () => void {
  let inFlight = false;
  const timer = setInterval(() => {
    if (signal.aborted || inFlight) return;
    inFlight = true;
    void heartbeat().catch(() => {
      console.error("[email-worker] WORKER_MONITOR_WRITE_FAILED");
    }).finally(() => { inFlight = false; });
  }, 30_000);
  timer.unref?.();
  const stop = () => {
    clearInterval(timer);
    signal.removeEventListener("abort", stop);
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  return stop;
}

async function finishWithin(task: Promise<unknown>, milliseconds: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task.then(() => true, () => false),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function validateDatabaseConfiguration(): void {
  if (!process.env.DATABASE_URL) {
    throw new EmailWorkerConfigurationError(["DATABASE_URL_REQUIRED"], "DATABASE_CONFIGURATION_INVALID");
  }
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new EmailWorkerConfigurationError(["DATABASE_URL_INVALID"], "DATABASE_CONFIGURATION_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new EmailWorkerConfigurationError(["DATABASE_URL_INVALID"], "DATABASE_CONFIGURATION_INVALID");
  }
}

export async function runEmailWorker(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.some((argument) => argument !== "--check-config")) {
    throw new Error("WORKER_ARGUMENT_INVALID");
  }
  const issues: EmailWorkerConfigurationIssue[] = [];
  for (const validate of [validateInternalEmailConfiguration, validateDatabaseConfiguration]) {
    try {
      validate();
    } catch (cause) {
      if (!(cause instanceof EmailWorkerConfigurationError)) throw cause;
      issues.push(...cause.issues);
    }
  }
  if (issues.length) throw new EmailWorkerConfigurationError(issues, "WORKER_CONFIGURATION_INVALID");
  if (args.includes("--check-config")) {
    console.log("[email-worker] Configuration valid; no database or SMTP connection attempted.");
    return;
  }

  // These are intentionally loaded only after --check-config has returned.
  // The web app singleton installs its own shutdown handlers and must not be used.
  const [{ PrismaPg }, { Pool }, { PrismaClient }, { createEmailDeliveryWorkerService }, { createEmailWorkerMonitor }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("pg"),
    import("@/lib/generated/prisma/client"),
    import("@/lib/domains/email-delivery/worker-service"),
    import("@/lib/domains/email-delivery/worker-monitor"),
  ]);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10_000,
  });
  const client = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: false }) });
  const workerRunId = randomUUID();
  const monitor = createEmailWorkerMonitor(client, workerRunId);
  pool.on("error", () => {
    console.error("[email-worker] DATABASE_CONNECTION_FAILED");
    void monitor.failure("DATABASE_CONNECTION_FAILED");
  });
  const controller = new AbortController();
  const stop = () => {
    if (controller.signal.aborted) return;
    controller.abort();
    void monitor.stopping();
  };
  void monitor.start();
  // Continue heartbeats during the drain period so a live stopping worker stays observable.
  const stopHeartbeat = startWorkerHeartbeat(() => monitor.heartbeat(), new AbortController().signal);
  // Readiness requires a successful queue poll, including access to outbox tables.
  let lastProgress = 0;
  const server = createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/health") {
      response.writeHead(404).end();
      return;
    }
    const respond = (healthy: boolean) => {
      response.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ status: healthy ? "ok" : "unhealthy" }));
    };
    if (controller.signal.aborted || Date.now() - lastProgress > healthThresholdMs) {
      respond(false);
      return;
    }
    // pg supports a per-query timeout; its QueryConfig declaration omits it.
    const healthQuery = { text: "SELECT 1", query_timeout: 5_000 };
    void pool.query(healthQuery).then(
      () => respond(!controller.signal.aborted && Date.now() - lastProgress <= healthThresholdMs),
      () => respond(false),
    );
  });
  const close = async (markStopped: boolean) => {
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    // Telemetry shares the existing five-second cleanup budget and cannot extend it.
    if (markStopped) await finishWithin(monitor.stopped(), 1_000);
    await client.$disconnect();
    await pool.end();
    await closed;
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  let drained = true;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(3101, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    server.on("error", () => {
      console.error("[email-worker] HEALTH_SERVER_FAILED");
      void monitor.failure("HEALTH_SERVER_FAILED");
      stop();
    });
    const processor = createEmailDeliveryWorkerService(client, sendInternalLeaderEmail, {
      workerRunId,
      onJobStarted: (id) => monitor.jobStarted(id),
      onJobFinished: () => monitor.jobFinished(),
    });
    const running = runDeliveryLoop(processor, controller.signal, () => {
      lastProgress = Date.now();
      void monitor.progress();
    }, () => { void monitor.failure("DELIVERY_PROCESSING_FAILED"); });
    const stopped = new Promise<void>((resolve) => {
      if (controller.signal.aborted) resolve();
      else controller.signal.addEventListener("abort", () => resolve(), { once: true });
    });
    console.log("[email-worker] Worker started; health endpoint listening on loopback port 3101.");
    await Promise.race([running, stopped]);
    stop();
    drained = await finishWithin(running, shutdownGraceMs);
    if (!drained) {
      console.error("[email-worker] SHUTDOWN_DELIVERY_TIMEOUT");
      void monitor.failure("SHUTDOWN_DELIVERY_TIMEOUT");
    }
  } catch (cause) {
    void monitor.failure("WORKER_RUNTIME_FAILED");
    throw cause;
  } finally {
    stop();
    stopHeartbeat();
    const closed = await finishWithin(close(drained), 5_000);
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    if (!drained || !closed) {
      // Leave an unfinished lease recoverable; never mark an uncertain SMTP send successful.
      console.error("[email-worker] SHUTDOWN_INCOMPLETE");
      process.exit(1);
    }
  }
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  void runEmailWorker().catch((cause: unknown) => {
    if (cause instanceof EmailWorkerConfigurationError) {
      console.error("[email-worker] WORKER_CONFIGURATION_INVALID; correct the settings below.");
      for (const issue of cause.issues) {
        console.error(`[email-worker] ${issue}: ${emailWorkerConfigurationMessages[issue]}`);
      }
    } else {
      console.error("[email-worker] WORKER_STARTUP_FAILED; verify worker arguments, runtime dependencies and health-port availability.");
    }
    process.exitCode = 1;
  });
}
