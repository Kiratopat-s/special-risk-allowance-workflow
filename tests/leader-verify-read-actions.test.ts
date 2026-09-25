import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), detail: vi.fn(), tokenReview: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/domains/leader-verification", () => ({ leaderVerificationService: {
  listPendingForLeader: mock.list, getClaimDetailForLeader: mock.detail, getVerificationByToken: mock.tokenReview,
} }));
vi.mock("@/lib/domains/leader-verification/repository", () => ({ leaderVerificationRepository: {} }));
vi.mock("@/lib/domains/signature/repository", () => ({ signatureRepository: {} }));

import { getMyVerificationClaimDetail, getVerificationByToken, listMyPendingVerifications } from "@/app/actions/leader-verify";

beforeEach(() => vi.resetAllMocks());

describe("public token review action", () => {
  it("delegates using only the token without requiring an account session", async () => {
    const result = { success: true, data: { state: "ready", id: "verification1" } };
    mock.tokenReview.mockResolvedValue(result);
    expect(await getVerificationByToken("current-token")).toEqual(result);
    expect(mock.tokenReview).toHaveBeenCalledExactlyOnceWith("current-token");
    expect(mock.auth).not.toHaveBeenCalled();
    expect(mock.detail).not.toHaveBeenCalled();
  });

  it.each(["INVALID_TOKEN", "TOKEN_NOT_FOUND", "TOKEN_EXPIRED"])("preserves the service's %s failure", async (code) => {
    const failure = { success: false, error: "ไม่สามารถเปิดเอกสาร", code };
    mock.tokenReview.mockResolvedValue(failure);
    expect(await getVerificationByToken("invalid-token")).toEqual(failure);
    expect(mock.auth).not.toHaveBeenCalled();
  });

  it("preserves the minimal already-verified receipt", async () => {
    const receipt = { success: true, data: { state: "already_verified", offSiteWorkId: "order1", verifiedAt: new Date() } };
    mock.tokenReview.mockResolvedValue(receipt);
    expect(await getVerificationByToken("signed-token")).toEqual(receipt);
  });
});

describe("leader queue read actions", () => {
  it.each([null, { user: {} }])("requires a database user session before reading", async (session) => {
    mock.auth.mockResolvedValue(session);
    expect(await listMyPendingVerifications()).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(await getMyVerificationClaimDetail("claim1")).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.detail).not.toHaveBeenCalled();
  });

  it("binds queue and detail queries to the logged-in leader", async () => {
    mock.auth.mockResolvedValue({ user: { dbUserId: "leader1" } });
    mock.list.mockResolvedValue({ success: true, data: [] });
    mock.detail.mockResolvedValue({ success: true, data: { id: "claim1" } });
    expect(await listMyPendingVerifications()).toEqual({ success: true, data: [] });
    expect(await getMyVerificationClaimDetail("claim1")).toEqual({ success: true, data: { id: "claim1" } });
    expect(mock.list).toHaveBeenCalledExactlyOnceWith("leader1");
    expect(mock.detail).toHaveBeenCalledExactlyOnceWith("claim1", "leader1");
  });

  it("preserves inaccessible-detail failures without adding unrelated read permissions", async () => {
    mock.auth.mockResolvedValue({ user: { dbUserId: "other-leader" } });
    mock.detail.mockResolvedValue({ success: false, error: "Not found", code: "CLAIM_NOT_FOUND" });
    expect(await getMyVerificationClaimDetail("private-claim"))
      .toEqual({ success: false, error: "Not found", code: "CLAIM_NOT_FOUND" });
    expect(mock.detail).toHaveBeenCalledWith("private-claim", "other-leader");
  });
});
