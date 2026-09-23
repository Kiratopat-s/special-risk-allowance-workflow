import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const url = new URL(process.env.PRESENCE_TEST_DATABASE_URL || "http://invalid");
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
    !["/presence_upgrade", "/presence_fresh"].includes(url.pathname) ||
    !process.env.PRESENCE_TEST_CONTAINER?.startsWith("sraw-presence-test-")) {
    throw Error("Use bun run test:presence-db with its disposable database");
  }
  const { PrismaClient } = await import("@/lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) }) };
});

import { prisma } from "@/lib/db";
import { presenceRepository } from "@/lib/domains/presence/repository";

function userData(id: string) {
  return { id, keycloakId: id, email: `${id}@example.test`, firstName: "Presence", lastName: "Test" };
}

beforeEach(async () => { await prisma.user.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("presence with PostgreSQL", () => {
  it("has an indexed millisecond-precision timestamp and starts with no online users", async () => {
    const columns = await prisma.$queryRaw<Array<{ data_type: string; datetime_precision: number }>>`
      SELECT data_type, datetime_precision FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_presence' AND column_name = 'last_seen_at'
    `;
    expect(columns).toEqual([{ data_type: "timestamp with time zone", datetime_precision: 3 }]);
    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'user_presence'
    `;
    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ indexname: "user_presence_last_seen_at_idx", indexdef: expect.stringContaining("(last_seen_at)") }),
      expect.objectContaining({ indexname: "user_presence_pkey", indexdef: expect.stringContaining("UNIQUE INDEX") }),
    ]));
    expect(await presenceRepository.getOnlineCount()).toMatchObject({ count: 0 });
  });

  it("counts concurrent tabs and devices once and records database time", async () => {
    const user = await prisma.user.create({ data: userData("concurrent") });
    const [before] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT statement_timestamp() AS now`;
    await Promise.all(Array.from({ length: 30 }, () => presenceRepository.heartbeat(user.id)));
    const snapshot = await presenceRepository.getOnlineCount();
    const rows = await prisma.userPresence.findMany();
    expect(rows).toHaveLength(1);
    expect(snapshot.count).toBe(1);
    expect(rows[0].lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.now.getTime());
    expect(rows[0].lastSeenAt.getTime()).toBeLessThanOrEqual(Date.parse(snapshot.measuredAt));
  });

  it("skips recent writes and refreshes an old row only once during a race", async () => {
    const user = await prisma.user.create({ data: userData("write-throttle") });
    await presenceRepository.heartbeat(user.id);
    const first = await prisma.userPresence.findUniqueOrThrow({ where: { userId: user.id } });
    await Promise.all(Array.from({ length: 20 }, () => presenceRepository.heartbeat(user.id)));
    expect(await prisma.userPresence.findUniqueOrThrow({ where: { userId: user.id } })).toEqual(first);
    await prisma.$executeRaw`
      UPDATE user_presence SET last_seen_at = statement_timestamp() - INTERVAL '46 seconds' WHERE user_id = ${user.id}
    `;
    const aged = await prisma.userPresence.findUniqueOrThrow({ where: { userId: user.id } });
    await Promise.all(Array.from({ length: 20 }, () => presenceRepository.heartbeat(user.id)));
    const refreshed = await prisma.userPresence.findUniqueOrThrow({ where: { userId: user.id } });
    expect(refreshed.lastSeenAt.getTime()).toBeGreaterThan(aged.lastSeenAt.getTime() + 45000);
    await presenceRepository.heartbeat(user.id);
    expect(await prisma.userPresence.findUniqueOrThrow({ where: { userId: user.id } })).toEqual(refreshed);
  });

  it("expires accounts at the 180-second cutoff using the snapshot database clock", async () => {
    const ids = ["recent", "near-cutoff", "at-cutoff", "expired"];
    await prisma.user.createMany({ data: ids.map(userData) });
    await prisma.$executeRaw`
      INSERT INTO user_presence (user_id, last_seen_at) VALUES
        ('recent', statement_timestamp()),
        ('near-cutoff', statement_timestamp() - INTERVAL '179 seconds'),
        ('at-cutoff', statement_timestamp() - INTERVAL '180 seconds'),
        ('expired', statement_timestamp() - INTERVAL '181 seconds')
    `;
    const snapshot = await presenceRepository.getOnlineCount();
    const rows = await prisma.userPresence.findMany();
    const cutoff = Date.parse(snapshot.measuredAt) - 180000;
    expect(snapshot.count).toBe(2);
    expect(snapshot.count).toBe(rows.filter((row) => row.lastSeenAt.getTime() > cutoff).length);
    expect(rows).toHaveLength(4); // Expiration does not need a cleanup job.
  });

  it("does not update user timestamps or append heartbeat audit logs", async () => {
    const user = await prisma.user.create({ data: { ...userData("audit"), lastLoginAt: new Date("2026-09-01T00:00:00Z") } });
    await prisma.userActionLog.create({ data: { userId: user.id, actionType: "LOGIN", actionDescription: "Existing audit" } });
    const logs = await prisma.userActionLog.findMany();
    await presenceRepository.heartbeat(user.id);
    await presenceRepository.getOnlineCount();
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toEqual(user);
    expect(await prisma.userActionLog.findMany()).toEqual(logs);
  });

  it("rejects unknown accounts and cascades presence on account deletion", async () => {
    await expect(presenceRepository.heartbeat("missing-account")).rejects.toThrow();
    const user = await prisma.user.create({ data: userData("cascade") });
    await presenceRepository.heartbeat(user.id);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.userPresence.count()).toBe(0);
  });

  it("handles a burst of 1,000 distinct accounts with one row per account", async () => {
    const ids = Array.from({ length: 1000 }, (_, index) => `load-${index}`);
    await prisma.user.createMany({ data: ids.map(userData) });
    const startedAt = performance.now();
    await Promise.all(ids.map((id) => presenceRepository.heartbeat(id)));
    const snapshot = await presenceRepository.getOnlineCount();
    expect(snapshot.count).toBe(1000);
    expect(await prisma.userPresence.count()).toBe(1000);
    console.info(`Presence: 1,000-account heartbeat burst and count completed in ${Math.round(performance.now() - startedAt)} ms.`);
  });
});
