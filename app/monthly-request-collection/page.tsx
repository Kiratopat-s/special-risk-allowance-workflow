import { auth } from "@/lib/auth";
import { can, canExact, hasRole } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { listMonthlyRequestCollections } from "@/app/actions/monthly-request-collection";
import { MrcClient } from "./monthly-request-collection-client";
import type { MonthlyRequestCollectionWithRelations } from "@/lib/domains/monthly-request-collection";

// Serialize Decimal objects to plain numbers/strings
function serializeDecimal(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object") {
    if ("toJSON" in (obj as object)) {
      // Prisma Decimal has toJSON
      return (obj as { toJSON(): unknown }).toJSON();
    }
    if (Array.isArray(obj)) {
      return obj.map(serializeDecimal);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeDecimal(v)]),
    );
  }
  return obj;
}

export default async function MrcPage() {
  const session = await auth();
  const userId = session?.user?.dbUserId ?? "";

  const [canManage, isSuperAdmin, exactHpa, exactRk, exactDrt] =
    await Promise.all([
      can(userId, "MONTHLY_REQUEST", "MANAGE"),
      hasRole(userId, "super-admin"),
      canExact(userId, "MONTHLY_REQUEST", "REVIEW_HPA"),
      canExact(userId, "MONTHLY_REQUEST", "REVIEW_RK"),
      canExact(userId, "MONTHLY_REQUEST", "REVIEW_OK"),
    ]);

  // Super-admin can act on any stage; otherwise only exact permission holders
  const canHpa = exactHpa || isSuperAdmin;
  const canRk = exactRk || isSuperAdmin;
  const canDrt = exactDrt || isSuperAdmin;

  if (!canManage && !canHpa && !canRk && !canDrt) {
    redirect("/");
  }

  const result = await listMonthlyRequestCollections({ page: 1, pageSize: 20 });
  const data = result.success
    ? {
        items: result.data.data.map((item) =>
          serializeDecimal(item),
        ) as MonthlyRequestCollectionWithRelations[],
        pagination: result.data.pagination,
      }
    : { items: [], pagination: null };

  return (
    <MrcClient
      initialItems={data.items}
      initialPagination={data.pagination}
      canManage={canManage}
      canHpa={canHpa}
      canRk={canRk}
      canDrt={canDrt}
    />
  );
}
