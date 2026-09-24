import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  verify: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/domains/leader-verification", () => ({
  leaderVerificationService: { verifyAsInternalLeader: mocks.verify },
}));
vi.mock("@/lib/domains/leader-verification/repository", () => ({ leaderVerificationRepository: {} }));
vi.mock("@/lib/domains/signature/repository", () => ({ signatureRepository: {} }));

import { verifyAsLeader } from "@/app/actions/leader-verify";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { dbUserId: "leader-a" } });
  mocks.verify.mockResolvedValue({ success: true, data: { verified: true, allDone: true, expenseClaimId: "claim-a" } });
});

describe("internal leader verification action", () => {
  it("forwards the displayed verification ID and authenticated actor with the signature", async () => {
    expect(await verifyAsLeader("claim-a", "work-a", "data:image/png;base64,c2ln", "verification-old")).toMatchObject({ success: true });
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith("claim-a", "work-a", "leader-a", Buffer.from("sig"), "verification-old");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/expense-claim-document");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it.each([undefined, "", "  "])("rejects an old client missing the expected verification ID: %j", async (expectedId) => {
    expect(await verifyAsLeader("claim-a", "work-a", undefined, expectedId)).toMatchObject({ success: false, code: "VERIFICATION_NOT_FOUND" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the stale-verification error without reporting or revalidating success", async () => {
    const stale = { success: false, error: "เอกสารมีการแก้ไข กรุณาเปิดรายการยืนยันใหม่", code: "VERIFICATION_NOT_FOUND" };
    mocks.verify.mockResolvedValue(stale);
    expect(await verifyAsLeader("claim-a", "work-a", undefined, "verification-old")).toEqual(stale);
    expect(mocks.verify).toHaveBeenCalledExactlyOnceWith("claim-a", "work-a", "leader-a", undefined, "verification-old");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests even when a verification ID is supplied", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await verifyAsLeader("claim-a", "work-a", undefined, "verification-old")).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
