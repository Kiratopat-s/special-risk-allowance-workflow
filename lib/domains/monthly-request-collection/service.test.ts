vi.mock("./repository");
vi.mock("@/lib/domains/permission/repository");
vi.mock("@/lib/domains/action-log/service");
vi.mock("@/lib/domains/notification", () => ({
  notificationService: {
    send: vi.fn().mockResolvedValue(undefined),
    sendToMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { monthlyRequestCollectionRepository as repo } from "./repository";
import { permissionRepository } from "@/lib/domains/permission/repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { monthlyRequestCollectionService } from "./service";

const mockRepo = repo as unknown as {
  findById: vi.Mock;
  findWithRelations: vi.Mock;
  findActiveForMonth: vi.Mock;
  findMany: vi.Mock;
  findEligibleExpenseClaimsForMonth: vi.Mock;
  create: vi.Mock;
  setExpenseClaims: vi.Mock;
  updateStatus: vi.Mock;
  findApprovalStep: vi.Mock;
  createApprovalStep: vi.Mock;
  reviewApprovalStep: vi.Mock;
  bulkUpdateLinkedClaimsStatus: vi.Mock;
  rollbackLinkedClaims: vi.Mock;
};

const mockLogService = actionLogService as unknown as { log: vi.Mock };
const mockPermRepo = permissionRepository as unknown as { findUserIdsByPermissionCode: vi.Mock };

const makeMrc = (overrides = {}) => ({
  id: "mrc1",
  status: "DRAFT",
  collectForMonth: new Date("2024-01-01"),
  collectorId: "collector1",
  expenseClaims: [{ userId: "u1" }],
  approvalSteps: [],
  ...overrides,
});

const makeMrcWithRelations = (overrides = {}) => ({
  ...makeMrc(overrides),
  expenseClaims: [{ id: "claim1", userId: "u1", status: "COLLECTED" }],
  approvalSteps: overrides.approvalSteps ?? [],
});

describe("monthlyRequestCollectionService", () => {
  describe("create", () => {
    it("creates MRC successfully", async () => {
      mockRepo.findActiveForMonth.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(makeMrc());
      mockRepo.setExpenseClaims.mockResolvedValue({});
      mockLogService.log.mockResolvedValue({});

      const result = await monthlyRequestCollectionService.create(
        { collectForMonth: "2024-01-01", expenseClaimIds: ["claim1"] },
        "actor1"
      );

      expect(result.success).toBe(true);
    });

    it("rejects when no claims selected", async () => {
      const result = await monthlyRequestCollectionService.create(
        { collectForMonth: "2024-01-01", expenseClaimIds: [] },
        "actor1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("NO_CLAIMS_SELECTED");
    });

    it("rejects when active MRC exists for month", async () => {
      mockRepo.findActiveForMonth.mockResolvedValue(makeMrc());

      const result = await monthlyRequestCollectionService.create(
        { collectForMonth: "2024-01-01", expenseClaimIds: ["claim1"] },
        "actor1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MRC_MONTH_CONFLICT");
    });
  });

  describe("update", () => {
    it("updates DRAFT MRC", async () => {
      mockRepo.findById.mockResolvedValue(makeMrc());
      mockRepo.setExpenseClaims.mockResolvedValue({});
      mockRepo.findById.mockResolvedValueOnce(makeMrc()).mockResolvedValueOnce(makeMrc());
      mockLogService.log.mockResolvedValue({});

      const result = await monthlyRequestCollectionService.update(
        "mrc1",
        { expenseClaimIds: ["claim1", "claim2"] },
        "actor1"
      );

      expect(result.success).toBe(true);
    });

    it("rejects when not DRAFT", async () => {
      mockRepo.findById.mockResolvedValue(makeMrc({ status: "PENDING" }));

      const result = await monthlyRequestCollectionService.update(
        "mrc1",
        { expenseClaimIds: ["claim1"] },
        "actor1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MRC_NOT_DRAFT");
    });

    it("rejects empty claims array", async () => {
      mockRepo.findById.mockResolvedValue(makeMrc());

      const result = await monthlyRequestCollectionService.update(
        "mrc1",
        { expenseClaimIds: [] },
        "actor1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("NO_CLAIMS_SELECTED");
    });
  });

  describe("submit", () => {
    it("transitions DRAFT to PENDING and creates HPA_CHECK step", async () => {
      mockRepo.findById.mockResolvedValue(makeMrc());
      mockRepo.updateStatus.mockResolvedValue({});
      mockRepo.createApprovalStep.mockResolvedValue({});
      mockRepo.findById.mockResolvedValueOnce(makeMrc()).mockResolvedValueOnce(makeMrc({ status: "PENDING" }));
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "PENDING" }));
      mockPermRepo.findUserIdsByPermissionCode.mockResolvedValue([]);
      mockLogService.log.mockResolvedValue({});

      const result = await monthlyRequestCollectionService.submit("mrc1", "actor1");

      expect(result.success).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith("mrc1", "PENDING");
      expect(mockRepo.createApprovalStep).toHaveBeenCalledWith("mrc1", "HPA_CHECK");
    });

    it("rejects when not DRAFT", async () => {
      mockRepo.findById.mockResolvedValue(makeMrc({ status: "PENDING" }));

      const result = await monthlyRequestCollectionService.submit("mrc1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MRC_NOT_DRAFT");
    });
  });

  describe("reviewStep", () => {
    it("HPA approves and advances to RK_CHECK", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "PENDING" }));
      mockRepo.findApprovalStep.mockResolvedValue({ status: "PENDING" });
      mockRepo.reviewApprovalStep.mockResolvedValue({});
      mockRepo.createApprovalStep.mockResolvedValue({});
      mockRepo.findById.mockResolvedValue(makeMrc({ status: "PENDING" }));
      mockPermRepo.findUserIdsByPermissionCode.mockResolvedValue([]);
      mockLogService.log.mockResolvedValue({});

      const result = await monthlyRequestCollectionService.reviewStep(
        "mrc1",
        { stage: "HPA_CHECK", approved: true },
        "reviewer1"
      );

      expect(result.success).toBe(true);
      expect(mockRepo.createApprovalStep).toHaveBeenCalledWith("mrc1", "RK_CHECK");
    });

    it("OK approves and sets MRC to APPROVED", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "PENDING" }));
      // HPA and RK already approved
      mockRepo.findApprovalStep.mockImplementation(async (_id: string, stage: string) => {
        if (stage === "HPA_CHECK" || stage === "RK_CHECK") return { status: "APPROVED" };
        return { status: "PENDING" };
      });
      mockRepo.reviewApprovalStep.mockResolvedValue({});
      mockRepo.updateStatus.mockResolvedValue({});
      mockRepo.bulkUpdateLinkedClaimsStatus.mockResolvedValue({});
      mockRepo.findById.mockResolvedValue(makeMrc({ status: "APPROVED" }));
      mockLogService.log.mockResolvedValue({});

      const result = await monthlyRequestCollectionService.reviewStep(
        "mrc1",
        { stage: "OK_APPROVE", approved: true },
        "reviewer1"
      );

      expect(result.success).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith("mrc1", "APPROVED");
      expect(mockRepo.bulkUpdateLinkedClaimsStatus).toHaveBeenCalledWith("mrc1", "APPROVED");
    });

    it("rejection sets MRC to REJECTED and rolls back claims", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "PENDING" }));
      mockRepo.findApprovalStep.mockResolvedValue({ status: "PENDING" });
      mockRepo.reviewApprovalStep.mockResolvedValue({});
      mockRepo.updateStatus.mockResolvedValue({});
      mockRepo.rollbackLinkedClaims.mockResolvedValue({});
      mockRepo.findById.mockResolvedValue(makeMrc({ status: "REJECTED" }));
      mockLogService.log.mockResolvedValue({});

      const result = await monthlyRequestCollectionService.reviewStep(
        "mrc1",
        { stage: "HPA_CHECK", approved: false, remark: "Not enough info" },
        "reviewer1"
      );

      expect(result.success).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith("mrc1", "REJECTED");
      expect(mockRepo.rollbackLinkedClaims).toHaveBeenCalledWith("mrc1");
    });

    it("rejects when MRC not PENDING", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "DRAFT" }));

      const result = await monthlyRequestCollectionService.reviewStep(
        "mrc1",
        { stage: "HPA_CHECK", approved: true },
        "reviewer1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MRC_NOT_PENDING");
    });

    it("rejects when step not pending", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "PENDING" }));
      mockRepo.findApprovalStep.mockResolvedValue(null);

      const result = await monthlyRequestCollectionService.reviewStep(
        "mrc1",
        { stage: "HPA_CHECK", approved: true },
        "reviewer1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("STEP_NOT_PENDING");
    });

    it("rejects when prior stage not approved", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "PENDING" }));
      // RK step is pending, but HPA is not approved
      mockRepo.findApprovalStep.mockImplementation(async (_id: string, stage: string) => {
        if (stage === "RK_CHECK") return { status: "PENDING" };
        return { status: "PENDING" }; // HPA not approved
      });

      const result = await monthlyRequestCollectionService.reviewStep(
        "mrc1",
        { stage: "RK_CHECK", approved: true },
        "reviewer1"
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("STEP_SEQUENCE_VIOLATED");
    });
  });

  describe("cancel", () => {
    it("cancels DRAFT MRC and rolls back claims", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "DRAFT" }));
      mockRepo.updateStatus.mockResolvedValue({});
      mockRepo.rollbackLinkedClaims.mockResolvedValue({});
      mockLogService.log.mockResolvedValue({});

      const result = await monthlyRequestCollectionService.cancel("mrc1", "actor1");

      expect(result.success).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith("mrc1", "CANCELLED", expect.any(Date));
      expect(mockRepo.rollbackLinkedClaims).toHaveBeenCalledWith("mrc1");
    });

    it("rejects when already cancelled", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "CANCELLED" }));

      const result = await monthlyRequestCollectionService.cancel("mrc1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MRC_ALREADY_CANCELLED");
    });

    it("rejects when already approved", async () => {
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "APPROVED" }));

      const result = await monthlyRequestCollectionService.cancel("mrc1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MRC_APPROVED");
    });

    it("rejects when has approved step", async () => {
      mockRepo.findWithRelations.mockResolvedValue(
        makeMrcWithRelations({
          status: "PENDING",
          approvalSteps: [{ status: "APPROVED" }],
        })
      );

      const result = await monthlyRequestCollectionService.cancel("mrc1", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("MRC_STEP_ALREADY_APPROVED");
    });
  });
});
