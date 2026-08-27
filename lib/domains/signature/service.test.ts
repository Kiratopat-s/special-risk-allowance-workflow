vi.mock("./repository");

import { signatureRepository } from "./repository";
import { signatureService } from "./service";

const repo = signatureRepository as unknown as {
  findActiveByUserId: vi.Mock;
  findHistoryByUserId: vi.Mock;
  findOwnedById: vi.Mock;
  create: vi.Mock;
  updateData: vi.Mock;
  activate: vi.Mock;
  softDelete: vi.Mock;
};

const makeBuffer = (size: number) => Buffer.alloc(size, 0x01);
const makeEntity = (overrides = {}) => ({
  id: "sig1",
  userId: "u1",
  signatureData: Buffer.from("test"),
  isActive: true,
  activatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe("signatureService", () => {
  describe("create", () => {
    it("creates signature and returns ViewModel", async () => {
      const entity = makeEntity();
      repo.create.mockResolvedValue(entity);

      const result = await signatureService.create("u1", {
        signatureData: Buffer.from("test"),
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dataUrl).toContain("data:image/png;base64,");
      }
    });

    it("rejects empty buffer", async () => {
      const result = await signatureService.create("u1", {
        signatureData: Buffer.alloc(0),
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("EMPTY_DATA");
    });

    it("rejects buffer larger than 2MB", async () => {
      const result = await signatureService.create("u1", {
        signatureData: makeBuffer(2 * 1024 * 1024 + 1),
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("TOO_LARGE");
    });
  });

  describe("update", () => {
    it("updates signature successfully", async () => {
      const existing = makeEntity();
      const updated = makeEntity({ signatureData: Buffer.from("new") });
      repo.findOwnedById.mockResolvedValue(existing);
      repo.updateData.mockResolvedValue(updated);

      const result = await signatureService.update("sig1", "u1", {
        signatureData: Buffer.from("new"),
      });

      expect(result.success).toBe(true);
    });

    it("returns error when not found", async () => {
      repo.findOwnedById.mockResolvedValue(null);

      const result = await signatureService.update("missing", "u1", {
        signatureData: Buffer.from("test"),
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("NOT_FOUND");
    });

    it("rejects empty buffer", async () => {
      const result = await signatureService.update("sig1", "u1", {
        signatureData: Buffer.alloc(0),
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("EMPTY_DATA");
    });
  });

  describe("activate", () => {
    it("activates signature", async () => {
      const existing = makeEntity({ isActive: false });
      const activated = makeEntity({ isActive: true });
      repo.findOwnedById.mockResolvedValue(existing);
      repo.activate.mockResolvedValue(activated);

      const result = await signatureService.activate("sig1", "u1");

      expect(result.success).toBe(true);
      expect(repo.activate).toHaveBeenCalledWith("sig1", "u1");
    });

    it("returns success without calling repo when already active", async () => {
      const existing = makeEntity({ isActive: true });
      repo.findOwnedById.mockResolvedValue(existing);

      const result = await signatureService.activate("sig1", "u1");

      expect(result.success).toBe(true);
      expect(repo.activate).not.toHaveBeenCalled();
    });

    it("returns error when not found", async () => {
      repo.findOwnedById.mockResolvedValue(null);

      const result = await signatureService.activate("missing", "u1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("NOT_FOUND");
    });
  });

  describe("softDelete", () => {
    it("soft-deletes signature", async () => {
      repo.findOwnedById.mockResolvedValue(makeEntity());
      repo.softDelete.mockResolvedValue({});

      const result = await signatureService.softDelete("sig1", "u1");

      expect(result.success).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith("sig1");
    });

    it("returns error when not found", async () => {
      repo.findOwnedById.mockResolvedValue(null);

      const result = await signatureService.softDelete("missing", "u1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("NOT_FOUND");
    });
  });

  describe("getPageState", () => {
    it("returns active signature and history", async () => {
      const history = [
        { id: "sig1", isActive: true, activatedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: "sig2", isActive: false, activatedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      repo.findHistoryByUserId.mockResolvedValue(history);

      const result = await signatureService.getPageState("u1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active?.id).toBe("sig1");
        expect(result.data.history).toHaveLength(2);
      }
    });
  });
});
