vi.mock("./repository");
vi.mock("@/lib/domains/action-log/service");

import { offSiteWorkRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { offSiteWorkService } from "./service";

const repo = offSiteWorkRepository as unknown as {
  findById: vi.Mock;
  findWithRelations: vi.Mock;
  create: vi.Mock;
  update: vi.Mock;
  softDelete: vi.Mock;
  hasExpenseClaims: vi.Mock;
  findMany: vi.Mock;
  findByUser: vi.Mock;
};

const mockLogService = actionLogService as unknown as { log: vi.Mock };

describe("offSiteWorkService", () => {
  describe("getById", () => {
    it("returns record when found", async () => {
      const record = { id: "osw1" };
      repo.findWithRelations.mockResolvedValue(record);

      const result = await offSiteWorkService.getById("osw1");

      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual(record);
    });

    it("returns error when not found", async () => {
      repo.findWithRelations.mockResolvedValue(null);

      const result = await offSiteWorkService.getById("missing");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("OFF_SITE_WORK_NOT_FOUND");
    });
  });

  describe("create", () => {
    it("creates record successfully", async () => {
      const input = {
        id: "osw1",
        startDate: "2024-01-01",
        endDate: "2024-01-05",
        objective: "meeting",
        location: "Bangkok",
      };
      const created = { ...input, startDate: new Date(input.startDate), endDate: new Date(input.endDate) };
      repo.findById.mockResolvedValue(null);
      repo.create.mockResolvedValue(created);
      mockLogService.log.mockResolvedValue({});

      const result = await offSiteWorkService.create(input, "actor1");

      expect(result.success).toBe(true);
      expect(repo.create).toHaveBeenCalled();
    });

    it("rejects end date before start date", async () => {
      const input = {
        id: "osw1",
        startDate: "2024-01-10",
        endDate: "2024-01-05",
        objective: "meeting",
        location: "Bangkok",
      };

      const result = await offSiteWorkService.create(input, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INVALID_DATE_RANGE");
    });

    it("rejects empty ID", async () => {
      const input = {
        id: "",
        startDate: "2024-01-01",
        endDate: "2024-01-05",
        objective: "meeting",
        location: "Bangkok",
      };

      const result = await offSiteWorkService.create(input, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MISSING_ID");
    });

    it("rejects duplicate ID", async () => {
      const input = {
        id: "osw1",
        startDate: "2024-01-01",
        endDate: "2024-01-05",
        objective: "meeting",
        location: "Bangkok",
      };
      repo.findById.mockResolvedValue({ id: "osw1" });

      const result = await offSiteWorkService.create(input, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("DUPLICATE_ID");
    });
  });

  describe("update", () => {
    it("updates record successfully", async () => {
      const existing = {
        id: "osw1",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-05"),
        objective: "old",
        location: "old",
        innerRefDocumentId: null,
      };
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue({ ...existing, objective: "new" });
      mockLogService.log.mockResolvedValue({});

      const result = await offSiteWorkService.update("osw1", { objective: "new" }, "actor1");

      expect(result.success).toBe(true);
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await offSiteWorkService.update("missing", {}, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("OFF_SITE_WORK_NOT_FOUND");
    });

    it("rejects when new dates create invalid range", async () => {
      const existing = {
        id: "osw1",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-05"),
      };
      repo.findById.mockResolvedValue(existing);

      const result = await offSiteWorkService.update(
        "osw1",
        { startDate: "2024-01-10" },
        "actor1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INVALID_DATE_RANGE");
    });
  });

  describe("delete", () => {
    it("soft-deletes when no linked expense claims", async () => {
      repo.findById.mockResolvedValue({ id: "osw1", objective: "test", location: "test" });
      repo.hasExpenseClaims.mockResolvedValue(false);
      repo.softDelete.mockResolvedValue({});
      mockLogService.log.mockResolvedValue({});

      const result = await offSiteWorkService.delete("osw1", "actor1");

      expect(result.success).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith("osw1");
    });

    it("rejects when has linked expense claims", async () => {
      repo.findById.mockResolvedValue({ id: "osw1" });
      repo.hasExpenseClaims.mockResolvedValue(true);

      const result = await offSiteWorkService.delete("osw1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("HAS_EXPENSE_CLAIMS");
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await offSiteWorkService.delete("missing", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("OFF_SITE_WORK_NOT_FOUND");
    });
  });
});
