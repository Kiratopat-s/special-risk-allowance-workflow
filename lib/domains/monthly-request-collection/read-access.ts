import { can, canExact, hasRole } from "@/lib/auth/permissions";
import { error, success, type Result } from "@/lib/shared/types";
import type { CollectionReadAccess } from "./read-policy";

/** Same LIST / own-only READ fallback and reviewer capabilities as the collection list. */
export async function resolveCollectionReadAccess(userId: string): Promise<Result<CollectionReadAccess>> {
  const list = await can(userId, "MONTHLY_REQUEST", "LIST");
  if (!list && !(await can(userId, "MONTHLY_REQUEST", "READ"))) {
    return error("ไม่มีสิทธิ์อ่านชุดรวบรวมรายเดือน", "PERMISSION_DENIED");
  }
  const [manage, superAdmin, hpa, rk, ok] = await Promise.all([
    can(userId, "MONTHLY_REQUEST", "MANAGE"),
    hasRole(userId, "super-admin"),
    canExact(userId, "MONTHLY_REQUEST", "REVIEW_HPA"),
    canExact(userId, "MONTHLY_REQUEST", "REVIEW_RK"),
    canExact(userId, "MONTHLY_REQUEST", "REVIEW_OK"),
  ]);
  return success({ userId, ownOnly: !list, manage, superAdmin, hpa, rk, ok });
}
