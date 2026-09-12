import { afterAll, describe, expect, it, vi } from "vitest";

// The orchestrator supplies a private, freshly-created Docker database. Refuse
// ordinary application URLs and never import the application's database singleton.
vi.mock("@/lib/db", async () => {
  const url = new URL(process.env.MIGRATION_TEST_DATABASE_URL ?? "http://invalid");
  if (
    url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
    !["/migration_upgrade", "/migration_fresh"].includes(url.pathname) ||
    !process.env.MIGRATION_TEST_CONTAINER?.startsWith("sraw-migrations-")
  ) throw new Error("Run these tests through bun run test:migrations using its isolated database.");
  const { PrismaClient } = await import("@/lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) }) };
});

import { prisma } from "@/lib/db";
import { notificationRepository } from "@/lib/domains/notification/repository";
import { GET } from "@/app/api/health/route";

if (!["before", "after", "fresh"].includes(process.env.MIGRATION_TEST_PHASE ?? "")) {
  throw new Error("Missing migration test phase; use bun run test:migrations.");
}

afterAll(async () => { await prisma.$disconnect(); vi.restoreAllMocks(); });

if (process.env.MIGRATION_TEST_PHASE === "before") {
  it("reproduces the missing-column error before the repair", async () => {
    await expect(notificationRepository.countUnread("migration-user-a")).rejects.toMatchObject({ code: "P2022" });
  });
  it("rejects readiness when notification columns are absent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
} else {
  describe.sequential("notification schema and repository after migration", () => {
    it("provides the defaults, nullable timestamp, index, and readiness expected by the app", async () => {
      const rows = await prisma.notification.findMany();
      expect(rows).toHaveLength(5);
      expect(rows.every((row) => row.isDeleted === false && row.deletedAt === null)).toBe(true);
      const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef FROM pg_indexes
        WHERE schemaname = current_schema() AND tablename = 'notifications'
          AND indexname = 'notifications_user_id_is_deleted_created_at_idx'
      `;
      expect(indexes).toHaveLength(1);
      expect(indexes[0].indexdef).toContain("(user_id, is_deleted, created_at)");
      const response = await GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });

    it("counts and paginates only the recipient's visible notifications", async () => {
      expect(await notificationRepository.countUnread("migration-user-a")).toBe(2);
      expect(await notificationRepository.countUnread("migration-user-b")).toBe(1);
      const page = await notificationRepository.findByUserId("migration-user-a", 1, 2);
      expect(page.data).toHaveLength(2);
      expect(page.data.every((item) => item.id.startsWith("a-"))).toBe(true);
      expect(page.pagination.total).toBe(3);
      expect(page.pagination.hasNext).toBe(true);
    });

    it("preserves ownership and rows during individual and bulk soft deletion", async () => {
      await notificationRepository.softDelete("a-delete", "migration-user-b");
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: "a-delete" } })).isDeleted).toBe(false);
      await notificationRepository.softDelete("a-delete", "migration-user-a");
      const deleted = await prisma.notification.findUniqueOrThrow({ where: { id: "a-delete" } });
      expect(deleted.isDeleted).toBe(true);
      expect(deleted.deletedAt).toBeInstanceOf(Date);
      expect(deleted.isRead).toBe(false);
      expect(await notificationRepository.countUnread("migration-user-a")).toBe(1);
      expect((await notificationRepository.findByUserId("migration-user-a")).data.map((row) => row.id).sort()).toEqual(["a-read", "a-unread"]);

      expect(await notificationRepository.softDeleteAllRead("migration-user-a")).toBe(1);
      expect(await notificationRepository.softDeleteAllRead("migration-user-a")).toBe(0);
      expect((await notificationRepository.findByUserId("migration-user-a")).data.map((row) => row.id)).toEqual(["a-unread"]);
      expect((await notificationRepository.findByUserId("migration-user-b")).pagination.total).toBe(2);
      expect(await notificationRepository.countUnread("migration-user-b")).toBe(1);
      expect(await prisma.notification.count()).toBe(5);
      expect(await prisma.pushSubscription.count()).toBe(2);
    });

    it("creates new notifications with the existing payload and visible defaults", async () => {
      const result = await notificationRepository.create({
        userId: "migration-user-a", type: "SYSTEM_ANNOUNCEMENT",
        title: "New fixture", body: "Notification payload unchanged", link: "/dashboard",
      });
      expect(result).toMatchObject({ isDeleted: false, deletedAt: null, isRead: false, link: "/dashboard" });
      expect(await notificationRepository.countUnread("migration-user-a")).toBe(2);
    });
  });
}
