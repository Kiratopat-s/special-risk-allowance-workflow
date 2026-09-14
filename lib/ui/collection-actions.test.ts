import { it, expect } from "vitest";
import { collectionActionStage } from "./collection-actions";
it("offers only the pending HPA action", () => {
  const mrc = { status: "PENDING", approvalSteps: [{ stage: "HPA_CHECK", status: "PENDING" }] };
  expect(collectionActionStage(mrc, { hpa: true })).toBe("HPA_CHECK");
  expect(collectionActionStage(mrc, { hpa: false })).toBeNull();
});
it("never offers retired steps", () => {
  expect(collectionActionStage({ status: "PENDING", approvalSteps: [{ stage: "RK_CHECK", status: "PENDING" }, { stage: "OK_APPROVE", status: "PENDING" }] }, { hpa: true })).toBeNull();
});
it.each(["DRAFT", "APPROVED", "REJECTED", "CANCELLED"])("no review for %s", (status) => {
  expect(collectionActionStage({ status, approvalSteps: [{ stage: "HPA_CHECK", status: "PENDING" }] }, { hpa: true })).toBeNull();
});
