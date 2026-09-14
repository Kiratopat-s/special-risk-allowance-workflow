import type { Prisma } from "@/lib/generated/prisma/client";

export interface CollectionReadAccess {
  userId: string;
  ownOnly: boolean;
  manage: boolean;
  superAdmin: boolean;
  hpa: boolean;
}

/** Shared by list, detail, overview and both print routes, before pagination. */
export function collectionVisibilityWhere(
  { userId, ownOnly, manage, superAdmin, hpa }: CollectionReadAccess,
): Prisma.MonthlyRequestCollectionWhereInput {
  if (ownOnly) return { collectorId: userId };
  if (manage) return {};
  return {
    OR: [
      { collectorId: userId },
      hpa || superAdmin ? { status: { not: "DRAFT" } } : { status: "APPROVED" },
    ],
  };
}

export function canSeeCollection(
  mrc: { collectorId: string; status: string },
  access: CollectionReadAccess,
): boolean {
  if (access.ownOnly) return mrc.collectorId === access.userId;
  if (access.manage || mrc.collectorId === access.userId) return true;
  return access.hpa || access.superAdmin
    ? mrc.status !== "DRAFT"
    : mrc.status === "APPROVED";
}
