vi.mock("./repository");
vi.mock("@/lib/domains/action-log/service");
vi.mock("@/lib/domains/leader-verification");
vi.mock("@/lib/domains/leader-verification/repository");
vi.mock("@/lib/db", () => ({
  prisma: {
    offSiteWork: { findMany: vi.fn() },
  },
}));

import { expenseClaimDocumentRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { leaderVerificationService } from "@/lib/domains/leader-verification";
import { prisma } from "@/lib/db";
import { expenseClaimDocumentService } from "./service";

const repo = expenseClaimDocumentRepository as unknown as {
  findById: vi.Mock;
  findWithRelations: vi.Mock;
  findEligibleOffSiteWorksForUser: vi.Mock;
  create: vi.Mock;
  update: vi.Mock;
  updateStatus: vi.Mock;
  softDelete: vi.Mock;
  findMany: vi.Mock;
};

const mockLogService = actionLogService as unknown as { log: vi.Mock };
const mockLvService = leaderVerificationService as unknown as { createForClaim: vi.Mock };
const mockPrisma = prisma as unknown as { offSiteWork: { findMany: vi.Mock } };

const makeClaim = (overrides = {}) => ({
  id: "claim1",
  userId: "u1",
  status: "DRAFT",
  expenseMonth: new Date("2024-01-01"),
  remark: null,
  cancelledAt: null,
  claimantPositionAtSubmission: "Engineer",
  ...overrides,
});

describe("expenseClaimDocumentService", () => {
  describe("create", () => {
    it("creates draft claim successfully", async () => {
      repo.create.mockResolvedValue(makeClaim());
      mockLogService.log.mockResolvedValue({});

      const result = await expenseClaimDocumentService.create(
        {
          expenseMonth: "2024-01-01",
          claimantPositionAtSubmission: "Engineer",
          status: "DRAFT",
        },
        "actor1",
        "u1"
      );

      expect(result.success).toBe(true);
    });

    it("rejects missing claimant position", async () => {
      const result = await expenseClaimDocumentService.create(
        {
          expenseMonth: "2024-01-01",
          claimantPositionAtSubmission: "",
          status: "DRAFT",
        },
        "actor1",
        "u1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MISSING_CLAIMANT_POSITION");
    });

    it("rejects invalid selected dates format", async () => {
      const result = await expenseClaimDocumentService.create(
        {
          expenseMonth: "2024-01-01",
          claimantPositionAtSubmission: "Engineer",
          selectedDates: ["not-a-date"],
          status: "DRAFT",
        },
        "actor1",
        "u1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INVALID_SELECTED_DATES");
    });

    it("rejects OSW missing leader when not draft", async () => {
      mockPrisma.offSiteWork.findMany.mockResolvedValue([
        { id: "osw1", innerRefDocumentId: "REF-001", leaderUserId: null, leaderEmail: null },
      ]);

      const result = await expenseClaimDocumentService.create(
        {
          expenseMonth: "2024-01-01",
          claimantPositionAtSubmission: "Engineer",
          status: "PENDING",
          offSiteWorkIds: ["osw1"],
        },
        "actor1",
        "u1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("OSW_MISSING_LEADER");
    });
  });

  describe("update", () => {
    it("updates claim successfully", async () => {
      repo.findById.mockResolvedValue(makeClaim());
      repo.update.mockResolvedValue(makeClaim({ remark: "updated" }));
      mockLogService.log.mockResolvedValue({});

      const result = await expenseClaimDocumentService.update(
        "claim1",
        { remark: "updated" },
        "actor1"
      );

      expect(result.success).toBe(true);
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await expenseClaimDocumentService.update("missing", {}, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("CLAIM_NOT_FOUND");
    });

    it("rejects editing cancelled claim", async () => {
      repo.findById.mockResolvedValue(makeClaim({ status: "CANCELLED" }));

      const result = await expenseClaimDocumentService.update("claim1", {}, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("CLAIM_CANCELLED");
    });

    it("rejects invalid selected dates", async () => {
      repo.findById.mockResolvedValue(makeClaim());

      const result = await expenseClaimDocumentService.update(
        "claim1",
        { selectedDates: ["bad-date"] },
        "actor1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INVALID_SELECTED_DATES");
    });
  });

  describe("submitDraft", () => {
    it("submits draft with OSWs having leaders", async () => {
      const claim = makeClaim({
        status: "DRAFT",
        expenseClaimOffSiteWorks: [
          { offSiteWorkId: "osw1", offSiteWork: { id: "osw1", leaderUserId: "leader1", leaderEmail: null, innerRefDocumentId: "REF-001" } },
        ],
      });
      repo.findWithRelations.mockResolvedValue(claim);
      mockLvService.createForClaim.mockResolvedValue([{ id: "lv1" }]);
      repo.updateStatus.mockResolvedValue({});
      repo.findById.mockResolvedValue(makeClaim({ status: "PENDING_LEADER_VERIFY" }));
      mockLogService.log.mockResolvedValue({});

      const result = await expenseClaimDocumentService.submitDraft("claim1", "u1");

      expect(result.success).toBe(true);
      expect(repo.updateStatus).toHaveBeenCalledWith("claim1", "PENDING_LEADER_VERIFY");
    });

    it("rejects when not DRAFT", async () => {
      repo.findWithRelations.mockResolvedValue(makeClaim({ status: "PENDING" }));

      const result = await expenseClaimDocumentService.submitDraft("claim1", "u1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INVALID_STATUS");
    });

    it("rejects when actor is not owner", async () => {
      repo.findWithRelations.mockResolvedValue(makeClaim({ userId: "other-user" }));

      const result = await expenseClaimDocumentService.submitDraft("claim1", "u1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("FORBIDDEN");
    });

    it("rejects when OSW missing leader", async () => {
      const claim = makeClaim({
        status: "DRAFT",
        expenseClaimOffSiteWorks: [
          { offSiteWorkId: "osw1", offSiteWork: { id: "osw1", leaderUserId: null, leaderEmail: null, innerRefDocumentId: "REF-001" } },
        ],
      });
      repo.findWithRelations.mockResolvedValue(claim);

      const result = await expenseClaimDocumentService.submitDraft("claim1", "u1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("OSW_MISSING_LEADER");
    });

    it("transitions to PENDING when no OSWs", async () => {
      const claim = makeClaim({ status: "DRAFT", expenseClaimOffSiteWorks: [] });
      repo.findWithRelations.mockResolvedValue(claim);
      repo.updateStatus.mockResolvedValue({});
      repo.findById.mockResolvedValue(makeClaim({ status: "PENDING" }));
      mockLogService.log.mockResolvedValue({});

      const result = await expenseClaimDocumentService.submitDraft("claim1", "u1");

      expect(result.success).toBe(true);
      expect(repo.updateStatus).toHaveBeenCalledWith("claim1", "PENDING");
    });
  });

  describe("delete", () => {
    it("cancels claim successfully", async () => {
      repo.findById.mockResolvedValue(makeClaim({ status: "PENDING" }));
      repo.softDelete.mockResolvedValue({});
      mockLogService.log.mockResolvedValue({});

      const result = await expenseClaimDocumentService.delete("claim1", "actor1");

      expect(result.success).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith("claim1");
    });

    it("rejects cancelling approved claim", async () => {
      repo.findById.mockResolvedValue(makeClaim({ status: "APPROVED" }));

      const result = await expenseClaimDocumentService.delete("claim1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("CLAIM_ALREADY_APPROVED");
    });

    it("rejects cancelling already cancelled claim", async () => {
      repo.findById.mockResolvedValue(makeClaim({ status: "CANCELLED" }));

      const result = await expenseClaimDocumentService.delete("claim1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("CLAIM_CANCELLED");
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await expenseClaimDocumentService.delete("missing", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("CLAIM_NOT_FOUND");
    });
  });
});
