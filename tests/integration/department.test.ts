import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const url = new URL(process.env.DEPARTMENT_TEST_DATABASE_URL || "http://invalid");
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/department_test" || !process.env.DEPARTMENT_TEST_CONTAINER?.startsWith("sraw-department-test-")) {
    throw Error("Use bun run test:department-db with its disposable database");
  }
  const { PrismaClient } = await import("@/lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) }) };
});

import { prisma } from "@/lib/db";
import { departmentService } from "@/lib/domains/department/service";
import { DEFAULT_DEPARTMENTS, seedDepartments } from "@/lib/domains/department/seed";
import { authEvents } from "@/lib/auth/events";

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("department sync with PostgreSQL", () => {
  it("concurrent sign-ins share one department without unique-key failures", async () => {
    const profiles = Array.from({ length: 12 }, (_, i) => ({
      sub: `account-${i}`, email: `account-${i}@example.test`, given_name: "Test", family_name: "User",
      department: "แผนกทดสอบ", department_short: "ทส.",
    }));
    const sessions = await Promise.all(profiles.map((profile) => authEvents.onSignIn(profile)));
    expect(sessions.every((session) => session?.userId)).toBe(true);
    const departments = await prisma.department.findMany();
    expect(departments).toHaveLength(1);
    expect(await prisma.user.count({ where: { departmentId: departments[0].id } })).toBe(12);
  });

  it("seed and sign-in races preserve a single copy of every default", async () => {
    const [seed, ...resolved] = await Promise.all([
      seedDepartments(),
      ...DEFAULT_DEPARTMENTS.map((data) => departmentService.resolveFromKeycloak(data)),
    ]);
    expect(seed.conflicts).toEqual([]);
    expect(resolved.every((result) => result.success && result.data)).toBe(true);
    expect(await prisma.department.count()).toBe(5);
    expect(await seedDepartments()).toEqual({ departmentsCreated: 0, departmentsExisting: 5, conflicts: [] });
  });

  it("two incoming names sharing one abbreviation resolve to the same preserved record", async () => {
    const results = await Promise.all(["Name A", "Name B"].map((name) => departmentService.resolveFromKeycloak({ name, shortName: "SAME" })));
    expect(results.every((result) => result.success && result.data)).toBe(true);
    const ids = results.map((result) => result.success && result.data?.id);
    expect(new Set(ids).size).toBe(1);
    expect(await prisma.department.count()).toBe(1);
  });

  it("true conflicts still sign in, preserving existing membership and leaving new accounts unassigned", async () => {
    const first = await prisma.department.create({ data: { name: "Name A", shortName: "A", isActive: false, description: "Preserve" } });
    const second = await prisma.department.create({ data: { name: "Name B", shortName: "B" } });
    const before = await prisma.department.findMany({ orderBy: { name: "asc" } });
    const profile = { sub: "existing-account", email: "existing@example.test", given_name: "Before", family_name: "User", department: first.name, department_short: first.shortName! };
    const existing = await authEvents.onSignIn(profile);
    expect(existing?.userId).toBeTruthy();
    expect(await authEvents.onSignIn({ ...profile, given_name: "After", department_short: second.shortName! })).toEqual(existing);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: existing!.userId } })).toMatchObject({ firstName: "After", departmentId: first.id });
    const created = await authEvents.onSignIn({ ...profile, sub: "new-account", email: "new@example.test", department_short: second.shortName! });
    expect(created?.userId).toBeTruthy();
    expect(await prisma.user.findUniqueOrThrow({ where: { id: created!.userId } })).toMatchObject({ departmentId: null });
    expect(await prisma.department.findMany({ orderBy: { name: "asc" } })).toEqual(before);
  });
});
