import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/domains/leader-verification", () => ({ leaderVerificationService: {
  listPendingForLeader: mock.list, getClaimDetailForLeader: mock.detail,
} }));
vi.mock("@/lib/domains/leader-verification/repository", () => ({ leaderVerificationRepository: {} }));
vi.mock("@/lib/domains/signature/repository", () => ({ signatureRepository: {} }));

import { getMyVerificationClaimDetail, listMyPendingVerifications } from "@/app/actions/leader-verify";

beforeEach(() => vi.resetAllMocks());

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
