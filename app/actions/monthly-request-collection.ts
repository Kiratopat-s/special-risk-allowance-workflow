"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import {
  monthlyRequestCollectionService,
  type CompleteMrcInput,
  type CreateMrcInput,
  type CreateMrcReplacementInput,
  type EligibleExpenseClaimForCollection,
  type MrcDepartmentOption,
  type MrcFilterCriteria,
  type MonthlyRequestCollectionEntity,
  type MonthlyRequestCollectionWithRelations,
  type UpdateMrcInput,
  type VoidMrcResult,
} from "@/lib/domains/monthly-request-collection";
import type { PermissionAction } from "@/lib/generated/prisma/client";
import type { PaginatedResult, Result } from "@/lib/shared/types";

const unauthorized = <T>(): Result<T> => ({
  success: false,
  error: "Unauthorized",
  code: "UNAUTHORIZED",
});

const denied = <T>(): Result<T> => ({
  success: false,
  error: "Permission denied",
  code: "PERMISSION_DENIED",
});

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.dbUserId ?? null;
}

async function canForTarget(
  userId: string,
  action: PermissionAction,
  target: { departmentId: string; collectorId: string },
): Promise<boolean> {
  return can(userId, "MONTHLY_REQUEST", action, {
    departmentId: target.departmentId,
    targetOwnerId: target.collectorId,
  });
}

async function canCreateForDepartment(
  userId: string,
  departmentId: string,
): Promise<boolean> {
  return can(userId, "MONTHLY_REQUEST", "CREATE", {
    departmentId,
    targetOwnerId: userId,
  });
}

function revalidateMrc(id?: string): void {
  revalidatePath("/monthly-request-collection");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/monthly-request-collection/${id}/print`);
}

export async function listMonthlyRequestCollections(
  filters: MrcFilterCriteria = {},
): Promise<Result<PaginatedResult<MonthlyRequestCollectionWithRelations>>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const canList = await can(userId, "MONTHLY_REQUEST", "LIST");
  if (canList) return monthlyRequestCollectionService.list(filters);

  const canRead = await can(userId, "MONTHLY_REQUEST", "READ", {
    targetOwnerId: userId,
  });
  if (!canRead) return denied();
  return monthlyRequestCollectionService.list({ ...filters, collectorId: userId });
}

export async function getMonthlyRequestCollection(
  id: string,
): Promise<Result<MonthlyRequestCollectionWithRelations>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const mrcResult = await monthlyRequestCollectionService.getById(id);
  if (!mrcResult.success) {
    return {
      success: false,
      error: "Monthly request collection not found",
      code: "MRC_NOT_FOUND",
    };
  }
  const mrc = mrcResult.data;
  if (!(await canForTarget(userId, "READ", mrc))) return denied();
  return mrcResult;
}

export async function listMonthlyRequestDepartments(): Promise<
  Result<MrcDepartmentOption[]>
> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const [canCreate, canManage] = await Promise.all([
    can(userId, "MONTHLY_REQUEST", "CREATE"),
    can(userId, "MONTHLY_REQUEST", "MANAGE"),
  ]);
  if (!canCreate && !canManage) return denied();
  return monthlyRequestCollectionService.listDepartments();
}

export async function listEligibleExpenseClaimsForMonth(
  month: string,
  departmentId: string,
  existingMrcId?: string,
): Promise<Result<EligibleExpenseClaimForCollection[]>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!(await canCreateForDepartment(userId, departmentId))) return denied();

  if (existingMrcId) {
    const mrcResult = await monthlyRequestCollectionService.getById(existingMrcId);
    const mrc = mrcResult.success ? mrcResult.data : null;
    if (
      !mrc ||
      mrc.departmentId !== departmentId ||
      !(await canForTarget(userId, "UPDATE", mrc))
    ) {
      return denied();
    }
  }
  return monthlyRequestCollectionService.listEligibleExpenseClaims(
    month,
    departmentId,
    existingMrcId,
  );
}

export async function createMonthlyRequestCollection(
  data: CreateMrcInput,
): Promise<Result<MonthlyRequestCollectionEntity>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!(await canCreateForDepartment(userId, data.departmentId))) return denied();
  const result = await monthlyRequestCollectionService.create(data, userId);
  if (result.success) revalidateMrc(result.data.id);
  return result;
}

export async function updateMonthlyRequestCollection(
  id: string,
  data: UpdateMrcInput,
): Promise<Result<MonthlyRequestCollectionEntity>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const mrcResult = await monthlyRequestCollectionService.getById(id);
  if (!mrcResult.success) {
    return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
  }
  const mrc = mrcResult.data;
  if (!(await canForTarget(userId, "UPDATE", mrc))) return denied();
  const result = await monthlyRequestCollectionService.update(id, data, userId);
  if (result.success) revalidateMrc(id);
  return result;
}

export async function finalizeMonthlyRequestCollection(
  id: string,
): Promise<Result<MonthlyRequestCollectionEntity>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const mrcResult = await monthlyRequestCollectionService.getById(id);
  if (!mrcResult.success) {
    return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
  }
  const mrc = mrcResult.data;
  if (!(await canForTarget(userId, "FINALIZE", mrc))) return denied();
  const result = await monthlyRequestCollectionService.finalize(id, userId);
  if (result.success) revalidateMrc(id);
  return result;
}

export async function completeMonthlyRequestCollection(
  id: string,
  input: CompleteMrcInput,
): Promise<Result<MonthlyRequestCollectionEntity>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const mrcResult = await monthlyRequestCollectionService.getById(id);
  if (!mrcResult.success) {
    return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
  }
  const mrc = mrcResult.data;
  if (!(await canForTarget(userId, "COMPLETE", mrc))) return denied();
  const result = await monthlyRequestCollectionService.complete(id, input, userId);
  if (result.success) revalidateMrc(id);
  return result;
}

export async function cancelMonthlyRequestCollection(
  id: string,
  reason: string,
): Promise<Result<MonthlyRequestCollectionEntity>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const mrcResult = await monthlyRequestCollectionService.getById(id);
  if (!mrcResult.success) {
    return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
  }
  const mrc = mrcResult.data;
  if (!(await canForTarget(userId, "CANCEL", mrc))) return denied();
  const result = await monthlyRequestCollectionService.cancel(id, reason, userId);
  if (result.success) revalidateMrc(id);
  return result;
}

export async function voidMonthlyRequestCollection(
  id: string,
  reason: string,
): Promise<Result<VoidMrcResult>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const mrcResult = await monthlyRequestCollectionService.getById(id);
  if (!mrcResult.success) {
    return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
  }
  const mrc = mrcResult.data;
  if (!(await canForTarget(userId, "VOID", mrc))) return denied();
  const result = await monthlyRequestCollectionService.void(id, reason, userId);
  if (result.success) revalidateMrc(id);
  return result;
}

export async function createMonthlyRequestReplacement(
  input: CreateMrcReplacementInput,
): Promise<Result<MonthlyRequestCollectionEntity>> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const firstId = input.voidedMrcIds[0];
  const firstResult = firstId
    ? await monthlyRequestCollectionService.getById(firstId)
    : null;
  const first = firstResult?.success ? firstResult.data : null;
  if (!first) {
    return { success: false, error: "Collection not found", code: "MRC_NOT_FOUND" };
  }
  if (!(await canCreateForDepartment(userId, first.departmentId))) return denied();
  const result = await monthlyRequestCollectionService.createReplacement(input, userId);
  if (result.success) revalidateMrc(result.data.id);
  return result;
}
