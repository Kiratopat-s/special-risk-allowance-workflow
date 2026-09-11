import type { Prisma } from "@/lib/generated/prisma/client";
export interface CollectionReadAccess {
  userId: string;
  ownOnly: boolean;
  manage: boolean;
  superAdmin: boolean;
  hpa: boolean;
  rk: boolean;
  ok: boolean;
}
/** Mirrors list visibility, including the legacy READ fallback and mixed-role stage checks. */
export function collectionVisibilityWhere(
  access: CollectionReadAccess,
): Prisma.MonthlyRequestCollectionWhereInput {
  const { userId, ownOnly, manage, superAdmin, hpa, rk, ok } = access;
  if (ownOnly) return { collectorId: userId };
  if (manage) return {};
  const approved = (
    stage: "HPA_CHECK" | "RK_CHECK",
  ): Prisma.MonthlyRequestCollectionWhereInput => ({
    approvalSteps: { some: { stage, status: "APPROVED" } },
  });
  const pending: Prisma.MonthlyRequestCollectionWhereInput =
    superAdmin || hpa || !(hpa || rk || ok)
      ? {}
      : {
          OR: [
            ...(rk ? [approved("HPA_CHECK")] : []),
            ...(ok
              ? [{ AND: [approved("HPA_CHECK"), approved("RK_CHECK")] }]
              : []),
          ],
        };
  return {
    OR: [
      { collectorId: userId },
      { status: { notIn: ["DRAFT", "PENDING"] } },
      { status: "PENDING", ...pending },
    ],
  };
}
export function canSeeCollection(
  mrc: {
    collectorId: string;
    status: string;
    approvalSteps: { stage: string; status: string }[];
  },
  access: CollectionReadAccess,
): boolean {
  if (access.ownOnly) return mrc.collectorId === access.userId;
  if (access.manage || mrc.collectorId === access.userId) return true;
  if (mrc.status === "DRAFT") return false;
  if (
    mrc.status !== "PENDING" ||
    access.superAdmin ||
    access.hpa ||
    !(access.hpa || access.rk || access.ok)
  )
    return true;
  const approved = (stage: string) =>
    mrc.approvalSteps.some(
      (step) => step.stage === stage && step.status === "APPROVED",
    );
  return (
    (access.rk && approved("HPA_CHECK")) ||
    (access.ok && approved("HPA_CHECK") && approved("RK_CHECK"))
  );
}
