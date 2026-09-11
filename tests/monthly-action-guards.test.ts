import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  can: vi.fn(),
  exact: vi.fn(),
  role: vi.fn(),
  signature: vi.fn(),
  find: vi.fn(),
  step: vi.fn(),
  review: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("@/lib/auth/permissions", () => ({
  can: mock.can,
  canExact: mock.exact,
  hasRole: mock.role,
}));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("@/lib/domains/monthly-request-collection", () => ({
  monthlyRequestCollectionService: { reviewStep: mock.review },
  monthlyRequestCollectionRepository: {
    findById: mock.find,
    findApprovalStep: mock.step,
  },
}));
vi.mock("@/lib/domains/signature", () => ({
  signatureRepository: { findActiveByUserId: mock.signature },
}));
import { reviewMonthlyRequestCollectionStep } from "@/app/actions/monthly-request-collection";
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ user: { dbUserId: "me" } });
  mock.role.mockResolvedValue(false);
  mock.exact.mockResolvedValue(true);
  mock.can.mockResolvedValue(true);
  mock.signature.mockResolvedValue({ id: "active" });
  mock.find.mockResolvedValue({ status: "PENDING" });
  mock.step.mockResolvedValue({ status: "APPROVED" });
  mock.review.mockResolvedValue({
    success: true,
    data: { amount: null, countDates: null },
  });
});
it("rejects expired sessions before any review", async () => {
  mock.auth.mockResolvedValue(null);
  expect(
    await reviewMonthlyRequestCollectionStep("m", {
      stage: "HPA_CHECK",
      approved: true,
    }),
  ).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  expect(mock.review).not.toHaveBeenCalled();
});
it.each(["HPA_CHECK", "RK_CHECK", "OK_APPROVE"] as const)(
  "requires an active signature at %s",
  async (stage) => {
    mock.signature.mockResolvedValue(null);
    expect(
      await reviewMonthlyRequestCollectionStep("m", { stage, approved: true }),
    ).toMatchObject({ success: false, code: "SIGNATURE_REQUIRED" });
    expect(mock.review).not.toHaveBeenCalled();
  },
);
it("does not let MANAGE stand in for an exact stage permission", async () => {
  mock.exact.mockResolvedValue(false);
  expect(
    await reviewMonthlyRequestCollectionStep("m", {
      stage: "RK_CHECK",
      approved: true,
    }),
  ).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
  expect(mock.review).not.toHaveBeenCalled();
});
it.each(["RK_CHECK", "OK_APPROVE"] as const)(
  "rejects skipped prior stages for %s",
  async (stage) => {
    mock.step.mockResolvedValue({ status: "PENDING" });
    expect(
      await reviewMonthlyRequestCollectionStep("m", { stage, approved: true }),
    ).toMatchObject({ success: false, code: "STEP_SEQUENCE_VIOLATED" });
    expect(mock.review).not.toHaveBeenCalled();
  },
);
it("preserves the super-admin exception and rejection remarks", async () => {
  mock.exact.mockResolvedValue(false);
  mock.role.mockResolvedValue(true);
  const input = {
    stage: "HPA_CHECK" as const,
    approved: false,
    remark: "ข้อมูลไม่ครบ",
  };
  await reviewMonthlyRequestCollectionStep("m", input);
  expect(mock.review).toHaveBeenCalledWith("m", input, "me");
  expect(mock.revalidate).toHaveBeenCalledWith("/dashboard");
});
