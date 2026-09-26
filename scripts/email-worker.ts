import { createServer } from "node:http";
import { sendInternalLeaderEmail, validateInternalEmailConfiguration } from "@/lib/email/internal-leader";

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
): Promise<void> {
  while (!signal.aborted) {
    try {
      const processed = await processor.processNext();
      onProgress();
      if (processed) continue;
    } catch {
      // No connection strings, email addresses, SMTP responses or tokens in logs.
      console.error("[email-worker] DELIVERY_PROCESSING_FAILED");
    }
    await pause(idleDelayMs, signal);
  }
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
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("DATABASE_CONFIGURATION_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("DATABASE_CONFIGURATION_INVALID");
  }
}

export async function runEmailWorker(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.some((argument) => argument !== "--check-config")) {
    throw new Error("WORKER_ARGUMENT_INVALID");
  }
  validateInternalEmailConfiguration();
  validateDatabaseConfiguration();
  if (args.includes("--check-config")) {
    console.log("[email-worker] Configuration valid; no database or SMTP connection attempted.");
    return;
  }

  // These are intentionally loaded only after --check-config has returned.
  // The web app singleton installs its own shutdown handlers and must not be used.
  const [{ PrismaPg }, { Pool }, { PrismaClient }, { createEmailDeliveryWorkerService }] = await Promise.all([
    import("@prisma/adapter-pg"),
    import("pg"),
    import("@/lib/generated/prisma/client"),
    import("@/lib/domains/email-delivery/worker-service"),
  ]);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", () => console.error("[email-worker] DATABASE_CONNECTION_FAILED"));
  const client = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: false }) });
  const controller = new AbortController();
  const stop = () => controller.abort();
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
  const close = async () => {
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
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
      stop();
    });
    const processor = createEmailDeliveryWorkerService(client, sendInternalLeaderEmail);
    const running = runDeliveryLoop(processor, controller.signal, () => { lastProgress = Date.now(); });
    const stopped = new Promise<void>((resolve) => {
      if (controller.signal.aborted) resolve();
      else controller.signal.addEventListener("abort", () => resolve(), { once: true });
    });
    console.log("[email-worker] Worker started; health endpoint listening on loopback port 3101.");
    await Promise.race([running, stopped]);
    stop();
    drained = await finishWithin(running, shutdownGraceMs);
    if (!drained) console.error("[email-worker] SHUTDOWN_DELIVERY_TIMEOUT");
  } finally {
    stop();
    const closed = await finishWithin(close(), 5_000);
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
  void runEmailWorker().catch(() => {
    console.error("[email-worker] WORKER_STARTUP_FAILED; verify local email, URL, database and health-port configuration.");
    process.exitCode = 1;
  });
}
