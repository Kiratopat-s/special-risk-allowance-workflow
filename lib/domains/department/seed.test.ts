import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ createMany: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { department: db } }));
vi.mock("@/lib/domains/action-log/service", () => ({ actionLogService: {} }));

import { DEFAULT_DEPARTMENTS, seedDepartments } from "./seed";
import type { DepartmentEntity } from "./types";

let rows: DepartmentEntity[];
const requested = DEFAULT_DEPARTMENTS[0];

function existing(overrides: Partial<DepartmentEntity> = {}): DepartmentEntity {
  return {
    id: "existing-department",
    ...requested,
    description: "Keep this description",
    parentId: "existing-parent",
    isActive: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  rows = [];
  db.createMany.mockReset();
  db.findUnique.mockReset();
  db.createMany.mockImplementation(async ({ data, skipDuplicates }: {
    data: { name: string; shortName: string }[];
    skipDuplicates: boolean;
  }) => {
    expect(skipDuplicates).toBe(true);
    let count = 0;
    for (const entry of data) {
      if (rows.some((row) => row.name === entry.name || row.shortName === entry.shortName)) {
        continue;
      }
      rows.push(existing({
        ...entry,
        id: `created-${rows.length}`,
        description: null,
        parentId: null,
        isActive: true,
      }));
      count++;
    }
    return { count };
  });
  db.findUnique.mockImplementation(async ({ where }: {
    where: { name?: string; shortName?: string };
  }) => rows.find((row) =>
    where.name !== undefined ? row.name === where.name : row.shortName === where.shortName
  ) ?? null);
});

describe("seedDepartments", () => {
  it("creates the five defaults once and skips them on subsequent runs", async () => {
    expect(await seedDepartments()).toEqual({
      departmentsCreated: 5, departmentsExisting: 0, conflicts: [],
    });
    const firstRun = structuredClone(rows);

    expect(await seedDepartments()).toEqual({
      departmentsCreated: 0, departmentsExisting: 5, conflicts: [],
    });
    expect(rows).toEqual(firstRun);
    expect(rows.map(({ name, shortName }) => ({ name, shortName }))).toEqual(DEFAULT_DEPARTMENTS);
  });

  it("preserves an exact match's inactive status, hierarchy, and metadata", async () => {
    const row = existing();
    rows.push(structuredClone(row));

    expect(await seedDepartments()).toEqual({
      departmentsCreated: 4, departmentsExisting: 1, conflicts: [],
    });
    expect(rows[0]).toEqual(row);
  });

  it.each([
    { label: "same name with another short name", row: existing({ shortName: "อื่น." }) },
    { label: "same name with no short name", row: existing({ shortName: null }) },
    { label: "same short name with another name", row: existing({ name: "หน่วยงานอื่น" }) },
  ])("reports $label and continues seeding other departments", async ({ row }) => {
    rows.push(structuredClone(row));

    const result = await seedDepartments();

    expect(result.departmentsCreated).toBe(4);
    expect(result.departmentsExisting).toBe(0);
    expect(result.conflicts).toHaveLength(1);
    for (const value of [requested.name, requested.shortName, row.id, row.name, JSON.stringify(row.shortName)]) {
      expect(result.conflicts[0]).toContain(value);
    }
    expect(rows[0]).toEqual(row);
    expect(rows).toHaveLength(5);
  });

  it("reports both records when the requested keys belong to different departments", async () => {
    const conflicting = [
      existing({ id: "name-owner", shortName: "อื่น." }),
      existing({ id: "short-name-owner", name: "หน่วยงานอื่น" }),
    ];
    rows.push(...structuredClone(conflicting));

    const result = await seedDepartments();

    expect(result.departmentsCreated).toBe(4);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toContain("name-owner");
    expect(result.conflicts[0]).toContain("short-name-owner");
    expect(rows.slice(0, 2)).toEqual(conflicting);
  });

  it("propagates database failures instead of treating them as conflicts", async () => {
    db.createMany.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(seedDepartments()).rejects.toThrow("Database unavailable");
  });

  it("fails if a skipped row disappears before its conflict can be inspected", async () => {
    db.createMany.mockResolvedValueOnce({ count: 0 });
    await expect(seedDepartments()).rejects.toThrow("Department disappeared");
  });
});
