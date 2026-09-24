import { authorizationService } from "@/lib/domains/permission/service";
import type { UserRoleWithDetails } from "@/lib/domains/permission/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { error, success, type Result } from "@/lib/shared/types";
import { claimReadRepository, type ClaimReadTarget } from "./read-repository";

export interface ClaimReadScope {
  scope: "ALL" | "OWN" | "DEPARTMENT";
  userId?: string;
  departmentIds: string[];
  includeOwn: boolean;
  where: Prisma.ExpenseClaimWhereInput;
}

interface ReadContext {
  userId: string;
  departmentId: string | null;
  roles: UserRoleWithDetails[];
}

async function readContext(userId: string): Promise<Result<ReadContext>> {
  const [roles, user] = await Promise.all([
    authorizationService.getUserRoles(userId),
    claimReadRepository.findUserDepartment(userId),
  ]);
  if (!roles.success) return roles;
  if (!user) return error("ไม่พบผู้ใช้งาน", "PERMISSION_DENIED");
  return success({ userId, departmentId: user.departmentId, roles: roles.data });
}

function ownScope(userId: string): ClaimReadScope {
  return {
    scope: "OWN", userId, departmentIds: [], includeOwn: true,
    where: { userId },
  };
}

/** Preserve direct-role permissions and exact-action precedence over MANAGE. */
function actionScope(context: ReadContext, action: "LIST" | "READ"): ClaimReadScope | null {
  const now = Date.now();
  const grants = context.roles
    .filter((assignment) => assignment.isActive && assignment.role.isActive &&
      (!assignment.expiresAt || assignment.expiresAt.getTime() > now))
    .flatMap((assignment) => assignment.role.permissions
      .filter((permission) => permission.isActive && permission.resource === "EXPENSE_CLAIM")
      .map((permission) => ({ permission, departmentId: assignment.departmentId })));
  const exact = grants.filter(({ permission }) => permission.action === action);
  const selected = exact.length ? exact : grants.filter(({ permission }) => permission.action === "MANAGE");
  const departments = new Set<string>();
  let includeOwn = false;

  for (const { permission, departmentId } of selected) {
    if (permission.scope === "ALL" && !departmentId) {
      return { scope: "ALL", departmentIds: [], includeOwn: false, where: {} };
    }
    if (permission.scope === "OWN") {
      if (!departmentId || departmentId === context.departmentId) includeOwn = true;
    } else {
      const allowedDepartment = departmentId ?? context.departmentId;
      if (allowedDepartment) departments.add(allowedDepartment);
    }
  }

  const departmentIds = [...departments].sort();
  if (!departmentIds.length) return includeOwn ? ownScope(context.userId) : null;
  const departmentWhere: Prisma.ExpenseClaimWhereInput = {
    claimant: { departmentId: { in: departmentIds } },
  };
  return {
    scope: "DEPARTMENT", departmentIds, includeOwn,
    ...(includeOwn && { userId: context.userId }),
    where: includeOwn ? { OR: [{ userId: context.userId }, departmentWhere] } : departmentWhere,
  };
}

function listScope(context: ReadContext): ClaimReadScope | null {
  const list = actionScope(context, "LIST");
  if (list) return list;
  const read = actionScope(context, "READ");
  // Legacy READ fallback is own-only, even when READ permits broader access.
  return read && canReadClaimInScope(read, {
    userId: context.userId, claimant: { departmentId: context.departmentId },
  }) ? ownScope(context.userId) : null;
}

function permitted(scope: ClaimReadScope | null): Result<ClaimReadScope> {
  return scope ? success(scope) : error("ไม่มีสิทธิ์อ่านคำขอเบิก", "PERMISSION_DENIED");
}

export function canReadClaimInScope(
  scope: ClaimReadScope,
  claim: Pick<ClaimReadTarget, "userId" | "claimant">,
): boolean {
  return scope.scope === "ALL" ||
    (scope.includeOwn && claim.userId === scope.userId) ||
    (!!claim.claimant.departmentId && scope.departmentIds.includes(claim.claimant.departmentId));
}

export async function resolveClaimReadScope(userId: string): Promise<Result<ClaimReadScope>> {
  const context = await readContext(userId);
  return context.success ? permitted(listScope(context.data)) : context;
}

export async function resolveClaimDetailScope(userId: string): Promise<Result<ClaimReadScope>> {
  const context = await readContext(userId);
  return context.success ? permitted(actionScope(context.data, "READ")) : context;
}

export async function resolveAnalyticsClaimScope(userId: string): Promise<Result<{
  scope: ClaimReadScope["scope"];
  where: Prisma.ExpenseClaimWhereInput;
}>> {
  const context = await readContext(userId);
  if (!context.success) return context;
  const list = listScope(context.data);
  const detail = actionScope(context.data, "READ");
  if (!list || !detail) return error("ไม่มีสิทธิ์อ่านรายละเอียดคำขอเบิก", "PERMISSION_DENIED");
  return success({
    scope: list.scope === "OWN" || detail.scope === "OWN" ? "OWN" :
      list.scope === "ALL" && detail.scope === "ALL" ? "ALL" : "DEPARTMENT",
    where: { AND: [list.where, detail.where] },
  });
}

/** Check only minimal metadata before fetching the document's sensitive relations. */
export async function requireReadableClaim(id: string, actorId: string): Promise<Result<ClaimReadTarget>> {
  const scope = await resolveClaimDetailScope(actorId);
  if (!scope.success) return scope;
  const claim = await claimReadRepository.findClaimTarget(id);
  if (!claim) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
  return canReadClaimInScope(scope.data, claim) ? success(claim) :
    error("ไม่มีสิทธิ์อ่านคำขอเบิกนี้", "PERMISSION_DENIED");
}
