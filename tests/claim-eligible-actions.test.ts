import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaimDocumentStatus, PermissionAction } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  can: vi.fn(),
  findById: vi.fn(),
  listEligible: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/permissions", () => ({ can: mocks.can }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/domains/expense-claim-document/read-scope", () => ({
  requireReadableClaim: vi.fn(),
  resolveClaimReadScope: vi.fn(),
}));
vi.mock("@/lib/shared/format", () => ({ bangkokCurrentMonth: () => "2026-09" }));
vi.mock("@/lib/domains/expense-claim-document", () => ({
  expenseClaimDocumentRepository: { findById: mocks.findById },
  expenseClaimDocumentService: { listEligibleOffSiteWorksForUser: mocks.listEligible },
}));

import { listEligibleOffSiteWorksForClaim } from "@/app/actions/expense-claim-document";

function claim(overrides: {
  userId?: string;
  status?: ClaimDocumentStatus;
  monthlyRequestCollectionId?: string | null;
} = {}) {
  return {
    id: "claim-a",
    userId: "user-a",
    status: "PENDING_LEADER_VERIFY",
    monthlyRequestCollectionId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { dbUserId: "user-a" } });
  mocks.can.mockResolvedValue(true);
  mocks.findById.mockResolvedValue(claim());
  mocks.listEligible.mockResolvedValue({ success: true, data: [{ id: "work-a" }] });
});

describe("claim off-site-work selection authorization", () => {
  it("uses CREATE permission and the signed-in claimant when creating", async () => {
    expect(await listEligibleOffSiteWorksForClaim()).toEqual({ success: true, data: [{ id: "work-a" }] });
    expect(mocks.can).toHaveBeenCalledExactlyOnceWith("user-a", "EXPENSE_CLAIM", "CREATE", { targetOwnerId: "user-a" });
    expect(mocks.listEligible).toHaveBeenCalledExactlyOnceWith("user-a", new Date("2026-09-01T00:00:00.000Z"));
    expect(mocks.findById).not.toHaveBeenCalled();
  });

  it("allows an UPDATE-only actor to select options for their existing claim", async () => {
    mocks.can.mockImplementation(async (_actor: string, _resource: string, action: PermissionAction) => action === "UPDATE");
    expect(await listEligibleOffSiteWorksForClaim("2026-09", "claim-a")).toMatchObject({ success: true });
    expect(mocks.can).toHaveBeenCalledExactlyOnceWith("user-a", "EXPENSE_CLAIM", "UPDATE", { targetOwnerId: "user-a" });
    expect(mocks.listEligible).toHaveBeenCalledExactlyOnceWith("user-a", new Date("2026-09-01T00:00:00.000Z"));
  });

  it("does not let an OWN editor replace the owner by passing another person's claim ID", async () => {
    mocks.findById.mockResolvedValue(claim({ userId: "user-b" }));
    mocks.can.mockImplementation(async (actor: string, _resource: string, _action: string, options: { targetOwnerId: string }) => actor === options.targetOwnerId);
    expect(await listEligibleOffSiteWorksForClaim("2026-09", "claim-b")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
    expect(mocks.findById).toHaveBeenCalledExactlyOnceWith("claim-b");
    expect(mocks.can).toHaveBeenCalledExactlyOnceWith("user-a", "EXPENSE_CLAIM", "UPDATE", { targetOwnerId: "user-b" });
    expect(mocks.listEligible).not.toHaveBeenCalled();
  });

  it("queries the actual claimant's options when an authorized admin edits another person's claim", async () => {
    mocks.findById.mockResolvedValue(claim({ userId: "user-b" }));
    expect(await listEligibleOffSiteWorksForClaim("2026-10", "claim-b")).toMatchObject({ success: true });
    expect(mocks.can).toHaveBeenCalledExactlyOnceWith("user-a", "EXPENSE_CLAIM", "UPDATE", { targetOwnerId: "user-b" });
    expect(mocks.listEligible).toHaveBeenCalledExactlyOnceWith("user-b", new Date("2026-10-01T00:00:00.000Z"));
  });

  it.each([
    claim({ status: "COLLECTED" }),
    claim({ status: "APPROVED" }),
    claim({ status: "CANCELLED" }),
    claim({ status: "DRAFT", monthlyRequestCollectionId: "collection-a" }),
  ])("refuses locked claims even for an authorized actor: %j", async (locked) => {
    mocks.findById.mockResolvedValue(locked);
    expect(await listEligibleOffSiteWorksForClaim("2026-09", "claim-a")).toMatchObject({ success: false, code: "CLAIM_LOCKED" });
    expect(mocks.listEligible).not.toHaveBeenCalled();
  });

  it("does not query claims or options without a signed-in user", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await listEligibleOffSiteWorksForClaim("2026-09", "claim-a")).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.listEligible).not.toHaveBeenCalled();
  });

  it("does not fall back to create mode when the requested claim is missing", async () => {
    mocks.findById.mockResolvedValue(null);
    expect(await listEligibleOffSiteWorksForClaim("2026-09", "missing")).toMatchObject({ success: false, code: "CLAIM_NOT_FOUND" });
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.listEligible).not.toHaveBeenCalled();
  });

  it("requires CREATE permission when no existing claim is supplied", async () => {
    mocks.can.mockResolvedValue(false);
    expect(await listEligibleOffSiteWorksForClaim("2026-09")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
    expect(mocks.listEligible).not.toHaveBeenCalled();
  });
});

describe("claim selection month validation", () => {
  it.each(["", "2026-00", "2026-13", "2026-1", "26-09", "2026-09-01", "2026-09 ", " 2026-09", "invalid"])(
    "rejects a malformed month instead of normalizing it: %s",
    async (month) => {
      expect(await listEligibleOffSiteWorksForClaim(month, "claim-a")).toMatchObject({ success: false, code: "INVALID_MONTH" });
      expect(mocks.listEligible).not.toHaveBeenCalled();
    }
  );

  it.each(["2026-01", "2026-12"])("accepts a valid month boundary: %s", async (month) => {
    expect(await listEligibleOffSiteWorksForClaim(month, "claim-a")).toMatchObject({ success: true });
    expect(mocks.listEligible).toHaveBeenCalledExactlyOnceWith("user-a", new Date(`${month}-01T00:00:00.000Z`));
  });
});
