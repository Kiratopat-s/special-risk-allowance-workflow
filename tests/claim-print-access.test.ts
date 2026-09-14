import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ can: vi.fn(), exact: vi.fn(), role: vi.fn(), claim: vi.fn(), claimPrint: vi.fn(), collection: vi.fn(), collectionPrint: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ can: mock.can, canExact: mock.exact, hasRole: mock.role }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/domains/expense-claim-document/repository", () => ({ expenseClaimDocumentRepository: { findById: mock.claim, findForPrint: mock.claimPrint } }));
vi.mock("@/lib/domains/monthly-request-collection/repository", () => ({ monthlyRequestCollectionRepository: { findPrintAccess: mock.collection, findClaimsForPrint: mock.collectionPrint } }));
import { expenseClaimDocumentService } from "@/lib/domains/expense-claim-document/service";
import { monthlyRequestCollectionService } from "@/lib/domains/monthly-request-collection/service";

beforeEach(() => {
  vi.clearAllMocks();
  mock.can.mockResolvedValue(false); mock.exact.mockResolvedValue(false); mock.role.mockResolvedValue(false);
  mock.claim.mockResolvedValue({ id: "claim", userId: "owner", status: "DRAFT" });
  mock.collection.mockResolvedValue({ collectorId: "collector", status: "PENDING", approvalSteps: [] });
  mock.collectionPrint.mockResolvedValue({ expenseClaims: [] });
  mock.claimPrint.mockResolvedValue(null);
});

describe("print authorization before signatures are fetched", () => {
  it("passes the actual claim owner into READ and blocks an unrelated user", async () => {
    expect(await expenseClaimDocumentService.getPrintData("claim", "stranger")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
    expect(mock.can).toHaveBeenCalledWith("stranger", "EXPENSE_CLAIM", "READ", { targetOwnerId: "owner" });
    expect(mock.claimPrint).not.toHaveBeenCalled();
  });
  it.each(["owner", "read-all-reviewer"])("allows an authorized %s to reach the print query", async (actor) => {
    mock.can.mockResolvedValue(true);
    await expenseClaimDocumentService.getPrintData("claim", actor);
    expect(mock.claimPrint).toHaveBeenCalledWith("claim", "owner");
  });
  it("does not print cancelled claims", async () => {
    mock.claim.mockResolvedValue({ id: "claim", userId: "owner", status: "CANCELLED" });
    expect(await expenseClaimDocumentService.getPrintData("claim", "owner")).toMatchObject({ code: "CLAIM_NOT_FOUND" });
    expect(mock.claimPrint).not.toHaveBeenCalled();
  });
  it("blocks collection data for a user with no collection access", async () => {
    expect(await monthlyRequestCollectionService.getClaimsPrintData("mrc", "stranger")).toMatchObject({ code: "PERMISSION_DENIED" });
    expect(mock.collectionPrint).not.toHaveBeenCalled();
  });
  it("keeps READ-only collection access own-only", async () => {
    mock.can.mockImplementation(async (_id, _resource, action) => action === "READ");
    expect(await monthlyRequestCollectionService.getClaimsPrintData("mrc", "stranger")).toMatchObject({ code: "PERMISSION_DENIED" });
    expect(await monthlyRequestCollectionService.getClaimsPrintData("mrc", "collector")).toEqual(expect.objectContaining({ success: true, data: [] }));
  });
  it("keeps another collector's draft private, allowing MANAGE", async () => {
    mock.collection.mockResolvedValue({ collectorId: "collector", status: "DRAFT", approvalSteps: [] });
    mock.can.mockImplementation(async (_id, _resource, action) => action === "LIST");
    expect(await monthlyRequestCollectionService.getClaimsPrintData("mrc", "viewer")).toMatchObject({ code: "PERMISSION_DENIED" });
    mock.can.mockResolvedValue(true);
    expect(await monthlyRequestCollectionService.getClaimsPrintData("mrc", "manager")).toMatchObject({ success: true });
  });
  it.each([
    ["REVIEW_HPA", "PENDING", true], ["REVIEW_RK", "PENDING", false],
    ["REVIEW_OK", "PENDING", false], ["REVIEW_RK", "APPROVED", true],
    ["REVIEW_OK", "APPROVED", true], ["READ", "REJECTED", false],
  ])("respects %s visibility for %s", async (role, status, allowed) => {
    mock.can.mockImplementation(async (_id, _resource, action) => action === "LIST");
    mock.exact.mockImplementation(async (_id, _resource, action) => action === role);
    mock.collection.mockResolvedValue({ collectorId: "collector", status, approvalSteps: [] });
    expect((await monthlyRequestCollectionService.getClaimsPrintData("mrc", "reader")).success).toBe(allowed);
    expect(mock.collectionPrint).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });
});
