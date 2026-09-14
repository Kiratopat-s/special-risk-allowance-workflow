import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./repository");
vi.mock("@/lib/domains/action-log/service");
import { departmentRepository } from "./repository";
import { departmentService } from "./service";
import type { DepartmentEntity } from "./types";

const row: DepartmentEntity = {
  id: "department-1", name: "แผนกฝึกอบรมช่าง", shortName: "ผอช.",
  description: "Preserve", parentId: "parent", isActive: false,
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
};
const find = vi.mocked(departmentRepository.findByIdentity);
const insert = vi.mocked(departmentRepository.createIfAbsent);

beforeEach(() => {
  vi.resetAllMocks();
  find.mockResolvedValue([row]);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Keycloak department identity", () => {
  it.each([
    { name: row.name, shortName: row.shortName! },
    { name: "different full name", shortName: row.shortName! },
    { name: row.name, shortName: "different abbreviation" },
    { name: row.name },
    { shortName: row.shortName! },
    { name: `  ${row.name}  `, shortName: ` ${row.shortName} ` },
  ])("reuses an existing identity and preserves metadata: %j", async (input) => {
    const snapshot = structuredClone(row);
    expect(await departmentService.resolveFromKeycloak(input)).toEqual({ success: true, data: row });
    expect(insert).not.toHaveBeenCalled();
    expect(departmentRepository.update).not.toHaveBeenCalled();
    expect(row).toEqual(snapshot);
  });

  it("reports both owners and the source without selecting a conflicting department", async () => {
    const other = { ...row, id: "department-2", name: "other", shortName: "other-short" };
    find.mockResolvedValue([row, other]);
    expect(await departmentService.resolveFromKeycloak({ name: row.name, shortName: other.shortName }, "/api/auth/callback/keycloak"))
      .toEqual({ success: true, data: null });
    expect(console.warn).toHaveBeenCalledWith("[department-sync] Identity discrepancy", {
      code: "DEPARTMENT_IDENTITY_CONFLICT", source: "/api/auth/callback/keycloak",
      incoming: { name: row.name, shortName: other.shortName },
      matches: [row, other].map(({ id, name, shortName }) => ({ id, name, shortName })),
      resolvedDepartmentId: null,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports a name difference when resolving by abbreviation", async () => {
    await departmentService.resolveFromKeycloak({ name: "alternate name", shortName: row.shortName! });
    expect(console.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      code: "DEPARTMENT_IDENTITY_MISMATCH", resolvedDepartmentId: row.id,
    }));
  });

  it("ignores blank claims and does not create a department from only an unknown abbreviation", async () => {
    expect(await departmentService.resolveFromKeycloak({ name: "  ", shortName: " " })).toEqual({ success: true, data: null });
    expect(find).not.toHaveBeenCalled();
    find.mockResolvedValue([]);
    expect(await departmentService.resolveFromKeycloak({ shortName: "unknown" })).toEqual({ success: true, data: null });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([true, false])("reads the winning record after duplicate-safe insertion (created=%s)", async (created) => {
    find.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
    insert.mockResolvedValue(created);
    expect(await departmentService.resolveFromKeycloak({ name: row.name })).toEqual({ success: true, data: row });
    expect(insert).toHaveBeenCalledWith({ name: row.name, shortName: undefined });
  });

  it("propagates storage failures and rejects a disappeared record", async () => {
    find.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(departmentService.resolveFromKeycloak({ name: row.name })).rejects.toThrow("database unavailable");
    find.mockResolvedValue([]);
    expect(await departmentService.resolveFromKeycloak({ name: row.name })).toMatchObject({ success: false, code: "DEPARTMENT_SYNC_FAILED" });
  });
});
