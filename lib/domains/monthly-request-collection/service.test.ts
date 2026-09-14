vi.mock("@/lib/auth/permissions", () => ({ can: vi.fn(), canExact: vi.fn(), hasRole: vi.fn() }));
import { can, canExact, hasRole } from "@/lib/auth/permissions";
import { notificationService } from "@/lib/domains/notification";
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
  submitForReview: vi.Mock;
  reviewCollection: vi.Mock;
  cancelCollection: vi.Mock;
  findPrintAccess: vi.Mock;
  findSummaryForPrint: vi.Mock;
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
      mockRepo.setExpenseClaims.mockResolvedValue({ success: true, data: makeMrc() });
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
      mockRepo.setExpenseClaims.mockResolvedValue({ success: true, data: makeMrc() });
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

  describe("single-stage transitions", () => {
    beforeEach(() => {
      vi.mocked(can).mockResolvedValue(true);
      vi.mocked(canExact).mockResolvedValue(true);
      vi.mocked(hasRole).mockResolvedValue(false);
      mockRepo.findWithRelations.mockResolvedValue(makeMrcWithRelations({ status: "PENDING" }));
      mockPermRepo.findUserIdsByPermissionCode.mockResolvedValue(["hpa1"]);
      mockLogService.log.mockResolvedValue({});
      vi.mocked(notificationService.sendToMany).mockResolvedValue(undefined);
    });
    it("submits to HPA and notifies the collector, claimants and HPA only", async () => {
      mockRepo.submitForReview.mockResolvedValue({ success: true, data: makeMrc({ status: "PENDING" }) });
      expect((await monthlyRequestCollectionService.submit("mrc1", "collector1")).success).toBe(true);
      expect(mockPermRepo.findUserIdsByPermissionCode).toHaveBeenCalledWith("monthly-request:review:hpa");
      expect(notificationService.sendToMany).toHaveBeenCalledWith(["collector1", "u1", "hpa1"], "MRC_SUBMITTED", expect.any(String), expect.any(String), expect.any(String));
    });
    it.each([true, false])("announces the final result only after the transaction succeeds: approved=%s", async (approved) => {
      const status = approved ? "APPROVED" : "REJECTED";
      mockRepo.reviewCollection.mockResolvedValue({ success: true, data: makeMrc({ status }) });
      const result = await monthlyRequestCollectionService.reviewStep("mrc1", { stage: "HPA_CHECK", approved }, "hpa1");
      expect(result).toMatchObject({ success: true, data: { status } });
      expect(notificationService.sendToMany).toHaveBeenCalledTimes(1);
      expect(notificationService.sendToMany).toHaveBeenCalledWith(["collector1", "u1"], approved ? "MRC_APPROVED" : "MRC_REJECTED", expect.any(String), expect.any(String), expect.any(String));
      expect(mockPermRepo.findUserIdsByPermissionCode).not.toHaveBeenCalled();
    });
    it.each(["RK_CHECK", "OK_APPROVE", "bogus"])("rejects unsupported stage %s before database access", async (stage) => {
      const result = await monthlyRequestCollectionService.reviewStep("mrc1", { stage: stage as "HPA_CHECK", approved: true }, "hpa1");
      expect(result).toMatchObject({ code: "INVALID_APPROVAL_STAGE" });
      expect(mockRepo.reviewCollection).not.toHaveBeenCalled();
    });
    it("does not accept MANAGE in place of the exact HPA permission", async () => {
      vi.mocked(canExact).mockResolvedValue(false);
      expect(await monthlyRequestCollectionService.reviewStep("mrc1", { stage: "HPA_CHECK", approved: true }, "manager")).toMatchObject({ code: "PERMISSION_DENIED" });
      expect(mockRepo.reviewCollection).not.toHaveBeenCalled();
    });
    it("keeps the super-admin exception", async () => {
      vi.mocked(canExact).mockResolvedValue(false);
      vi.mocked(hasRole).mockResolvedValue(true);
      mockRepo.reviewCollection.mockResolvedValue({ success: true, data: makeMrc({ status: "APPROVED" }) });
      expect((await monthlyRequestCollectionService.reviewStep("mrc1", { stage: "HPA_CHECK", approved: true }, "admin")).success).toBe(true);
    });
    it.each(["MRC_NOT_PENDING", "STEP_NOT_PENDING", "SIGNATURE_REQUIRED"])("returns %s without announcing a transition", async (code) => {
      mockRepo.reviewCollection.mockResolvedValue({ success: false, code, error: "fixture" });
      expect(await monthlyRequestCollectionService.reviewStep("mrc1", { stage: "HPA_CHECK", approved: true }, "hpa")).toMatchObject({ code });
      expect(mockLogService.log).not.toHaveBeenCalled();
      expect(notificationService.sendToMany).not.toHaveBeenCalled();
    });
    it("returns a Result on transaction failure without logging or notifying approval", async () => {
      mockRepo.reviewCollection.mockRejectedValue(new Error("db failure"));
      expect(await monthlyRequestCollectionService.reviewStep("mrc1", { stage: "HPA_CHECK", approved: true }, "hpa")).toMatchObject({ code: "MRC_UPDATE_FAILED" });
      expect(mockLogService.log).not.toHaveBeenCalled();
      expect(notificationService.sendToMany).not.toHaveBeenCalled();
    });
    it("cancels atomically before notifying participants", async () => {
      mockRepo.cancelCollection.mockResolvedValue({ success: true, data: makeMrc({ status: "CANCELLED" }) });
      expect((await monthlyRequestCollectionService.cancel("mrc1", "collector1")).success).toBe(true);
      expect(notificationService.sendToMany).toHaveBeenCalledWith(["collector1", "u1"], "MRC_CANCELLED", expect.any(String), expect.any(String), expect.any(String));
    });
    it.each(["MRC_ALREADY_CANCELLED", "MRC_APPROVED", "MRC_STEP_ALREADY_APPROVED"])("preserves cancellation guard %s", async (code) => {
      mockRepo.cancelCollection.mockResolvedValue({ success: false, code, error: "fixture" });
      expect(await monthlyRequestCollectionService.cancel("mrc1", "collector1")).toMatchObject({ code });
      expect(notificationService.sendToMany).not.toHaveBeenCalled();
    });
    it("denies detail and summary signatures before selecting them for a read-only viewer", async () => {
      vi.mocked(can).mockImplementation(async (_id, _resource, action) => action === "LIST");
      vi.mocked(canExact).mockResolvedValue(false);
      mockRepo.findPrintAccess.mockResolvedValue(makeMrc({ status: "PENDING" }));
      expect(await monthlyRequestCollectionService.getById("mrc1", "reader")).toMatchObject({ code: "PERMISSION_DENIED" });
      expect(await monthlyRequestCollectionService.getSummaryPrintData("mrc1", "reader")).toMatchObject({ code: "PERMISSION_DENIED" });
      expect(mockRepo.findSummaryForPrint).not.toHaveBeenCalled();
    });
  });
});
