vi.mock("./repository");
vi.mock("@/lib/db", () => ({
  prisma: {
    expenseClaim: { findUnique: vi.fn(), update: vi.fn() },
    leaderVerification: { findUnique: vi.fn(), update: vi.fn() },
    offSiteWork: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/email", () => ({
  sendLeaderVerifyEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/domains/notification", () => ({
  notificationService: {
    send: vi.fn().mockResolvedValue(undefined),
    sendToMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { leaderVerificationRepository } from "./repository";
import { prisma } from "@/lib/db";
import { leaderVerificationService } from "./service";

const repo = leaderVerificationRepository as unknown as {
  create: vi.Mock;
  createMany: vi.Mock;
  findByToken: vi.Mock;
  findByClaimAndOsw: vi.Mock;
  findPendingByLeaderUserId: vi.Mock;
  findAllByExpenseClaimId: vi.Mock;
  verify: vi.Mock;
  deleteByClaimAndOswIds: vi.Mock;
  deleteAllByClaimId: vi.Mock;
};

const mockPrisma = prisma as unknown as {
  expenseClaim: { findUnique: vi.Mock; update: vi.Mock };
  leaderVerification: { findUnique: vi.Mock; update: vi.Mock };
  offSiteWork: { findMany: vi.Mock };
};

const makeVerification = (overrides = {}) => ({
  id: "lv1",
  expenseClaimId: "claim1",
  offSiteWorkId: "osw1",
  leaderUserId: "leader1",
  leaderEmail: null,
  token: "token-abc",
  verifiedAt: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  ...overrides,
});

describe("leaderVerificationService", () => {
  describe("verifyByToken", () => {
    it("verifies successfully", async () => {
      const record = makeVerification();
      repo.findByToken.mockResolvedValue(record);
      repo.verify.mockResolvedValue({});
      repo.findAllByExpenseClaimId.mockResolvedValue([
        record,
        makeVerification({ id: "lv2", verifiedAt: new Date() }),
      ]);
      mockPrisma.expenseClaim.update.mockResolvedValue({});

      const result = await leaderVerificationService.verifyByToken("token-abc");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verified).toBe(true);
      }
    });

    it("returns error when token not found", async () => {
      repo.findByToken.mockResolvedValue(null);

      const result = await leaderVerificationService.verifyByToken("bad-token");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("VERIFICATION_NOT_FOUND");
    });

    it("returns success when already verified (idempotent)", async () => {
      repo.findByToken.mockResolvedValue(makeVerification({ verifiedAt: new Date() }));

      const result = await leaderVerificationService.verifyByToken("token-abc");

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.verified).toBe(true);
    });

    it("returns error when token expired", async () => {
      repo.findByToken.mockResolvedValue(
        makeVerification({ expiresAt: new Date(Date.now() - 1000) })
      );

      const result = await leaderVerificationService.verifyByToken("token-abc");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("TOKEN_EXPIRED");
    });
  });

  describe("verifyAsInternalLeader", () => {
    it("verifies successfully when userId matches", async () => {
      const record = makeVerification({ leaderUserId: "leader1" });
      repo.findByClaimAndOsw.mockResolvedValue(record);
      repo.verify.mockResolvedValue({});
      repo.findAllByExpenseClaimId.mockResolvedValue([record]);
      mockPrisma.expenseClaim.update.mockResolvedValue({});

      const result = await leaderVerificationService.verifyAsInternalLeader(
        "claim1",
        "osw1",
        "leader1"
      );

      expect(result.success).toBe(true);
    });

    it("rejects when userId does not match", async () => {
      repo.findByClaimAndOsw.mockResolvedValue(makeVerification({ leaderUserId: "other" }));

      const result = await leaderVerificationService.verifyAsInternalLeader(
        "claim1",
        "osw1",
        "wrong-user"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("NOT_LEADER");
    });

    it("returns success when already verified (idempotent)", async () => {
      repo.findByClaimAndOsw.mockResolvedValue(
        makeVerification({ leaderUserId: "leader1", verifiedAt: new Date() })
      );

      const result = await leaderVerificationService.verifyAsInternalLeader(
        "claim1",
        "osw1",
        "leader1"
      );

      expect(result.success).toBe(true);
    });

    it("returns error when expired", async () => {
      repo.findByClaimAndOsw.mockResolvedValue(
        makeVerification({
          leaderUserId: "leader1",
          expiresAt: new Date(Date.now() - 1000),
        })
      );

      const result = await leaderVerificationService.verifyAsInternalLeader(
        "claim1",
        "osw1",
        "leader1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("TOKEN_EXPIRED");
    });

    it("returns error when record not found", async () => {
      repo.findByClaimAndOsw.mockResolvedValue(null);

      const result = await leaderVerificationService.verifyAsInternalLeader(
        "claim1",
        "osw1",
        "leader1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("VERIFICATION_NOT_FOUND");
    });
  });

  describe("refreshToken", () => {
    it("refreshes token successfully", async () => {
      mockPrisma.leaderVerification.findUnique.mockResolvedValue(makeVerification());
      mockPrisma.leaderVerification.update.mockResolvedValue(makeVerification({ token: "new-token" }));

      const result = await leaderVerificationService.refreshToken("lv1", "admin1");

      expect(result.success).toBe(true);
    });

    it("rejects when already verified", async () => {
      mockPrisma.leaderVerification.findUnique.mockResolvedValue(
        makeVerification({ verifiedAt: new Date() })
      );

      const result = await leaderVerificationService.refreshToken("lv1", "admin1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("ALREADY_VERIFIED");
    });

    it("returns error when not found", async () => {
      mockPrisma.leaderVerification.findUnique.mockResolvedValue(null);

      const result = await leaderVerificationService.refreshToken("missing", "admin1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("VERIFICATION_NOT_FOUND");
    });
  });

  describe("createForClaim", () => {
    it("returns empty array when no OSW IDs", async () => {
      const result = await leaderVerificationService.createForClaim("claim1", []);

      expect(result).toEqual([]);
    });

    it("creates verifications for OSWs with leaders", async () => {
      mockPrisma.offSiteWork.findMany.mockResolvedValue([
        { id: "osw1", innerRefDocumentId: "REF-001", leaderUserId: "leader1", leaderEmail: null },
      ]);
      mockPrisma.expenseClaim.findUnique.mockResolvedValue({
        claimant: { firstName: "Test", lastName: "User" },
      });
      repo.createMany.mockResolvedValue({});
      repo.findAllByExpenseClaimId.mockResolvedValue([makeVerification()]);

      const result = await leaderVerificationService.createForClaim("claim1", ["osw1"]);

      expect(result).toHaveLength(1);
      expect(repo.createMany).toHaveBeenCalled();
    });

    it("skips OSWs without leaders", async () => {
      mockPrisma.offSiteWork.findMany.mockResolvedValue([
        { id: "osw1", innerRefDocumentId: "REF-001", leaderUserId: null, leaderEmail: null },
      ]);
      mockPrisma.expenseClaim.findUnique.mockResolvedValue(null);

      const result = await leaderVerificationService.createForClaim("claim1", ["osw1"]);

      expect(result).toEqual([]);
    });
  });
});
