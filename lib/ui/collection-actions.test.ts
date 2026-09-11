import { it, expect } from "vitest";
import { collectionActionStage } from "./collection-actions";
it("does not expose a skipped stage when steps arrive out of order", () => {
  const collection = {
    status: "PENDING",
    approvalSteps: [
      { stage: "OK_APPROVE", status: "PENDING" },
      { stage: "RK_CHECK", status: "PENDING" },
      { stage: "HPA_CHECK", status: "PENDING" },
    ],
  };
  expect(
    collectionActionStage(collection, { hpa: false, rk: false, ok: true }),
  ).toBeNull();
  expect(
    collectionActionStage(collection, { hpa: true, rk: true, ok: true }),
  ).toBe("HPA_CHECK");
});
it("selects the correct available stage for mixed roles after prior approvals", () => {
  const collection = {
    status: "PENDING",
    approvalSteps: [
      { stage: "OK_APPROVE", status: "PENDING" },
      { stage: "HPA_CHECK", status: "APPROVED" },
      { stage: "RK_CHECK", status: "PENDING" },
    ],
  };
  expect(
    collectionActionStage(collection, { hpa: false, rk: true, ok: true }),
  ).toBe("RK_CHECK");
});
it("does not expose review actions on terminal or draft collections", () => {
  for (const status of ["DRAFT", "APPROVED", "REJECTED", "CANCELLED"])
    expect(
      collectionActionStage(
        { status, approvalSteps: [{ stage: "HPA_CHECK", status: "PENDING" }] },
        { hpa: true, rk: true, ok: true },
      ),
    ).toBeNull();
});
