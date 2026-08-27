vi.mock("./repository");
vi.mock("@/lib/domains/action-log/service");

import { departmentRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { departmentService } from "./service";

const repo = departmentRepository as unknown as {
  findById: vi.Mock;
  findByName: vi.Mock;
  findByShortName: vi.Mock;
  create: vi.Mock;
  update: vi.Mock;
  delete: vi.Mock;
  countUsers: vi.Mock;
  hasChildren: vi.Mock;
  findWithHierarchy: vi.Mock;
  findRootDepartments: vi.Mock;
};

const mockLogService = actionLogService as unknown as { log: vi.Mock };

describe("departmentService", () => {
  describe("getById", () => {
    it("returns department when found", async () => {
      const dept = { id: "d1", name: "IT" };
      repo.findById.mockResolvedValue(dept);

      const result = await departmentService.getById("d1");

      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual(dept);
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await departmentService.getById("missing");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DEPARTMENT_NOT_FOUND");
    });
  });

  describe("create", () => {
    it("creates department when name is unique", async () => {
      const input = { name: "Finance", shortName: "FIN" };
      const created = { id: "d2", ...input, isActive: true };
      repo.findByName.mockResolvedValue(null);
      repo.findByShortName.mockResolvedValue(null);
      repo.create.mockResolvedValue(created);
      mockLogService.log.mockResolvedValue({});

      const result = await departmentService.create(input, "actor1");

      expect(result.success).toBe(true);
      expect(repo.create).toHaveBeenCalledWith(input);
      expect(mockLogService.log).toHaveBeenCalled();
    });

    it("rejects duplicate name", async () => {
      repo.findByName.mockResolvedValue({ id: "existing" });

      const result = await departmentService.create({ name: "IT" }, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DUPLICATE_NAME");
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects duplicate short name", async () => {
      repo.findByName.mockResolvedValue(null);
      repo.findByShortName.mockResolvedValue({ id: "existing" });

      const result = await departmentService.create({ name: "New", shortName: "IT" }, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DUPLICATE_SHORT_NAME");
    });

    it("rejects when parent not found", async () => {
      repo.findByName.mockResolvedValue(null);
      repo.findById.mockResolvedValue(null);

      const result = await departmentService.create(
        { name: "New", parentId: "missing" },
        "actor1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("PARENT_NOT_FOUND");
    });
  });

  describe("update", () => {
    it("updates department successfully", async () => {
      const existing = { id: "d1", name: "IT", shortName: null, parentId: null };
      const updated = { ...existing, name: "Tech" };
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(updated);
      mockLogService.log.mockResolvedValue({});

      const result = await departmentService.update("d1", { name: "Tech" }, "actor1");

      expect(result.success).toBe(true);
      expect(repo.update).toHaveBeenCalledWith("d1", { name: "Tech" });
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await departmentService.update("missing", { name: "X" }, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DEPARTMENT_NOT_FOUND");
    });

    it("rejects when name changed to existing name", async () => {
      repo.findById.mockResolvedValue({ id: "d1", name: "IT", shortName: null });
      repo.findByName.mockResolvedValue({ id: "d2", name: "Finance" });

      const result = await departmentService.update("d1", { name: "Finance" }, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DUPLICATE_NAME");
    });

    it("skips name uniqueness check when name unchanged", async () => {
      repo.findById.mockResolvedValue({ id: "d1", name: "IT", shortName: null, parentId: null });
      repo.update.mockResolvedValue({ id: "d1", name: "IT" });
      mockLogService.log.mockResolvedValue({});

      const result = await departmentService.update("d1", { name: "IT" }, "actor1");

      expect(result.success).toBe(true);
      expect(repo.findByName).not.toHaveBeenCalled();
    });

    it("rejects circular reference when parentId === id", async () => {
      repo.findById.mockResolvedValue({ id: "d1", name: "IT", shortName: null });

      const result = await departmentService.update("d1", { parentId: "d1" }, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("CIRCULAR_REFERENCE");
    });
  });

  describe("delete", () => {
    it("deletes when no users and no children", async () => {
      repo.findById.mockResolvedValue({ id: "d1", name: "Old" });
      repo.countUsers.mockResolvedValue(0);
      repo.hasChildren.mockResolvedValue(false);
      repo.delete.mockResolvedValue({});
      mockLogService.log.mockResolvedValue({});

      const result = await departmentService.delete("d1", "actor1");

      expect(result.success).toBe(true);
      expect(repo.delete).toHaveBeenCalledWith("d1");
    });

    it("rejects when department has users", async () => {
      repo.findById.mockResolvedValue({ id: "d1", name: "IT" });
      repo.countUsers.mockResolvedValue(5);

      const result = await departmentService.delete("d1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("HAS_USERS");
    });

    it("rejects when department has children", async () => {
      repo.findById.mockResolvedValue({ id: "d1", name: "IT" });
      repo.countUsers.mockResolvedValue(0);
      repo.hasChildren.mockResolvedValue(true);

      const result = await departmentService.delete("d1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("HAS_CHILDREN");
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await departmentService.delete("missing", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DEPARTMENT_NOT_FOUND");
    });
  });

  describe("toggleActive", () => {
    it("toggles from active to inactive", async () => {
      repo.findById.mockResolvedValue({ id: "d1", name: "IT", shortName: null, parentId: null, isActive: true });
      repo.update.mockResolvedValue({ id: "d1", isActive: false });
      mockLogService.log.mockResolvedValue({});

      const result = await departmentService.toggleActive("d1", "actor1");

      expect(result.success).toBe(true);
      expect(repo.update).toHaveBeenCalledWith("d1", { isActive: false });
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await departmentService.toggleActive("missing", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DEPARTMENT_NOT_FOUND");
    });
  });
});
