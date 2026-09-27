import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { createEmailWorkerMonitor, deriveWorkerState } from "@/lib/domains/email-delivery/worker-monitor";

const url = new URL(process.env.EMAIL_TEST_DATABASE_URL || "http://invalid");
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
  !["/email_upgrade", "/email_fresh"].includes(url.pathname) ||
  !process.env.EMAIL_TEST_CONTAINER?.startsWith("sraw-email-test-")) {
  throw new Error("Use bun run test:email-db with its disposable database.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
const ownedRunIds: string[] = [];
function fixtureMonitor() {
  const id = randomUUID();
  ownedRunIds.push(id);
  return { id, monitor: createEmailWorkerMonitor(prisma, id) };
}
async function measuredAt() {
  const [row] = await prisma.$queryRaw<{ measuredAt: Date }[]>`SELECT CURRENT_TIMESTAMP AS "measuredAt"`;
  return row.measuredAt;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.emailWorkerRun.deleteMany({ where: { id: { in: ownedRunIds.splice(0) } } });
});
afterAll(async () => { await prisma.$disconnect(); });

describe("worker monitoring with PostgreSQL", () => {
  it("registers, records progress and jobs, and stops without changing delivery data", async () => {
    const { id, monitor } = fixtureMonitor();
    const before = await measuredAt();
    await monitor.start();
    let run = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(run.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100);
    expect(deriveWorkerState(run, await measuredAt())).toBe("STARTING");
    const startedAt = run.startedAt;
    await monitor.progress();
    await monitor.jobStarted("a-delivery-scalar-without-a-foreign-key");
    run = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(deriveWorkerState(run, await measuredAt())).toBe("PROCESSING");
    expect(run.currentDeliveryId).toBe("a-delivery-scalar-without-a-foreign-key");
    await monitor.jobFinished();
    await monitor.progress();
    await monitor.heartbeat();
    run = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(run.startedAt).toEqual(startedAt);
    expect(run.currentDeliveryId).toBeNull();
    expect(deriveWorkerState(run, await measuredAt())).toBe("IDLE");
    await monitor.stopping();
    expect(deriveWorkerState(await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } }), await measuredAt())).toBe("STOPPING");
    await monitor.stopped();
    const stopped = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    await monitor.heartbeat();
    await monitor.jobStarted("late-callback");
    expect(await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } })).toEqual(stopped);
    expect(deriveWorkerState(stopped, await measuredAt())).toBe("STOPPED");
  });

  it("distinguishes a live stalled loop from missing heartbeats using database time", async () => {
    const { id, monitor } = fixtureMonitor();
    await monitor.start();
    await monitor.progress();
    await prisma.$executeRaw`UPDATE email_worker_runs SET last_progress_at = CURRENT_TIMESTAMP - INTERVAL '91 seconds' WHERE id = ${id}`;
    await monitor.heartbeat();
    let run = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(deriveWorkerState(run, await measuredAt())).toBe("STALLED");
    await prisma.$executeRaw`UPDATE email_worker_runs SET last_heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '91 seconds' WHERE id = ${id}`;
    run = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(deriveWorkerState(run, await measuredAt())).toBe("NO_SIGNAL");
  });

  it("retains safe last errors and recovers state after a successful queue poll", async () => {
    const { id, monitor } = fixtureMonitor();
    await monitor.start();
    await monitor.failure("DELIVERY_PROCESSING_FAILED");
    let run = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(run.lastErrorCode).toBe("DELIVERY_PROCESSING_FAILED");
    expect(deriveWorkerState(run, await measuredAt())).toBe("DEGRADED");
    await monitor.progress();
    run = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(run.lastErrorCode).toBe("DELIVERY_PROCESSING_FAILED");
    expect(deriveWorkerState(run, await measuredAt())).toBe("IDLE");
  });

  it("recovers missing registration after a failed write and keeps the original run start", async () => {
    const id = randomUUID();
    ownedRunIds.push(id);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const execute = vi.fn().mockRejectedValueOnce(new Error("private-database-response"))
      .mockImplementation((query) => prisma.$executeRaw(query));
    const monitor = createEmailWorkerMonitor({ $executeRaw: execute }, id);
    await expect(monitor.start()).resolves.toBeUndefined();
    expect(await prisma.emailWorkerRun.findUnique({ where: { id } })).toBeNull();
    await monitor.heartbeat();
    const registered = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    await monitor.start();
    const restarted = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id } });
    expect(restarted.startedAt).toEqual(registered.startedAt);
    expect(log).toHaveBeenCalledExactlyOnceWith("[email-worker] WORKER_MONITOR_WRITE_FAILED");
  });

  it("records a real worker's idle readiness and graceful stop", async () => {
    // The disposable harness runs database files sequentially; leave no runnable fixture jobs.
    await prisma.emailDelivery.deleteMany();
    const existing = await prisma.emailWorkerRun.findMany({ select: { id: true } });
    const worker = spawn("bun", ["scripts/email-worker.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env, NODE_ENV: "test", DATABASE_URL: url.href,
        EMAIL_HOST: "127.0.0.1", EMAIL_PORT: "1", EMAIL_USER: "fixture", EMAIL_PASS: "fixture",
        EMAIL_FROM: "fixture@example.test", NEXTAUTH_URL: "http://127.0.0.1:3000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    worker.stdout.on("data", (chunk) => { output += chunk; });
    worker.stderr.on("data", (chunk) => { output += chunk; });
    const exited = new Promise<number | null>((resolve, reject) => {
      worker.once("exit", resolve);
      worker.once("error", reject);
    });
    try {
      let activeId: string | undefined;
      for (let attempt = 0; attempt < 160; attempt++) {
        if (worker.exitCode !== null || worker.signalCode !== null) throw new Error(`Fixture worker exited: ${output}`);
        const active = await prisma.emailWorkerRun.findFirst({ where: { id: { notIn: existing.map((run) => run.id) } } });
        if (active && deriveWorkerState(active, await measuredAt()) === "IDLE") {
          activeId = active.id;
          ownedRunIds.push(activeId);
          break;
        }
        await delay(50);
      }
      expect(activeId, output).toBeDefined();
      const health = await fetch("http://127.0.0.1:3101/health");
      expect(health.status).toBe(200);
      worker.kill("SIGTERM");
      expect(await exited).toBe(0);
      const stopped = await prisma.emailWorkerRun.findUniqueOrThrow({ where: { id: activeId } });
      expect(stopped.stoppingAt).not.toBeNull();
      expect(stopped.stoppedAt).not.toBeNull();
      expect(stopped.currentDeliveryId).toBeNull();
      expect(deriveWorkerState(stopped, await measuredAt())).toBe("STOPPED");
    } finally {
      if (worker.exitCode === null && worker.signalCode === null) worker.kill("SIGKILL");
      await exited;
    }
  });
});
