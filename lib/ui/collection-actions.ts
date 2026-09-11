import type { MrcApprovalStage } from "@/lib/domains/monthly-request-collection/types";
export function collectionActionStage(
  collection: {
    status: string;
    approvalSteps: { stage: string; status: string }[];
  },
  permissions: { hpa: boolean; rk: boolean; ok: boolean },
): MrcApprovalStage | null {
  if (collection.status !== "PENDING") return null;
  const stages = ["HPA_CHECK", "RK_CHECK", "OK_APPROVE"] as const;
  const allowed = [permissions.hpa, permissions.rk, permissions.ok];
  for (let index = 0; index < stages.length; index++) {
    const step = collection.approvalSteps.find(
      (item) => item.stage === stages[index],
    );
    if (step?.status === "APPROVED") continue;
    return step?.status === "PENDING" && allowed[index] ? stages[index] : null;
  }
  return null;
}
