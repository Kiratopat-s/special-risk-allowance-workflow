vi.mock("./repository");

import { actionLogRepository } from "./repository";
import { actionLogService } from "./service";

const repo = actionLogRepository as unknown as {
  create: vi.Mock;
  findWithDetails: vi.Mock;
  findByUserId: vi.Mock;
  getLoginHistory: vi.Mock;
  findMany: vi.Mock;
  getRecentActivity: vi.Mock;
  countInDateRange: vi.Mock;
  countByType: vi.Mock;
  deleteOlderThan: vi.Mock;
};

describe("actionLogService", () => {
  describe("log", () => {
    it("creates log entry and returns entity", async () => {
      const entry = { id: "log1", userId: "u1" };
      repo.create.mockResolvedValue(entry);

      const result = await actionLogService.log({
        userId: "u1",
        actionType: "LOGIN" as any,
        actionDescription: "test",
      });

      expect(result).toEqual(entry);
      expect(repo.create).toHaveBeenCalled();
    });

    it("returns null when repository throws", async () => {
      repo.create.mockRejectedValue(new Error("db down"));

      const result = await actionLogService.log({
        userId: "u1",
        actionType: "LOGIN" as any,
        actionDescription: "test",
      });

      expect(result).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns log when found", async () => {
      const log = { id: "log1" };
      repo.findWithDetails.mockResolvedValue(log);

      const result = await actionLogService.getById("log1");

      expect(result.success).toBe(true);
    });

    it("returns error when not found", async () => {
      repo.findWithDetails.mockResolvedValue(null);

      const result = await actionLogService.getById("missing");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("LOG_NOT_FOUND");
    });
  });

  describe("cleanup", () => {
    it("deletes logs older than default 365 days", async () => {
      repo.deleteOlderThan.mockResolvedValue(5);

      const result = await actionLogService.cleanup();

      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(5);
      expect(repo.deleteOlderThan).toHaveBeenCalled();
    });

    it("uses custom retention days", async () => {
      repo.deleteOlderThan.mockResolvedValue(10);

      await actionLogService.cleanup(30);

      const cutoffArg = repo.deleteOlderThan.mock.calls[0][0] as Date;
      const expectedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // Allow 1 second tolerance
      expect(Math.abs(cutoffArg.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
    });
  });

  describe("logCrud", () => {
    it("maps known operation+entity to correct ActionType", async () => {
      repo.create.mockResolvedValue({ id: "log1" });

      await actionLogService.logCrud("u1", "CREATE", "DEPARTMENT", "d1");

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: "DEPARTMENT_CREATED" })
      );
    });

    it("falls back to OTHER for unknown combo", async () => {
      repo.create.mockResolvedValue({ id: "log1" });

      await actionLogService.logCrud("u1", "CREATE", "THING", "t1");

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: "OTHER" })
      );
    });
  });

  describe("getAuthDescription", () => {
    it("returns correct description for known types", () => {
      expect(actionLogService.getAuthDescription("LOGIN")).toBe("User logged in successfully");
      expect(actionLogService.getAuthDescription("LOGOUT")).toBe("User logged out");
      expect(actionLogService.getAuthDescription("LOGIN_FAILED")).toBe("Login attempt failed");
    });

    it("returns fallback for unknown type", () => {
      expect(actionLogService.getAuthDescription("UNKNOWN")).toBe("Authentication event");
    });
  });
});
