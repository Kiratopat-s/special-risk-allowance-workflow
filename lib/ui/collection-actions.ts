import type { MrcApprovalStage } from "@/lib/domains/monthly-request-collection/types";

export function collectionActionStage(
  collection: { status: string; approvalSteps: { stage: string; status: string }[] },
  permissions: { hpa: boolean },
): MrcApprovalStage | null {
  return collection.status === "PENDING" && permissions.hpa &&
    collection.approvalSteps.some((step) => step.stage === "HPA_CHECK" && step.status === "PENDING")
    ? "HPA_CHECK" : null;
}
