"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import {
  offSiteWorkService,
  type CreateOffSiteWorkInput,
  type OffSiteWorkEntity,
  type OffSiteWorkFilterCriteria,
  type OffSiteWorkWithRelations,
  type UpdateOffSiteWorkInput,
} from "@/lib/domains/off-site-work";
import { authorizationService } from "@/lib/domains/permission";
import type { PaginatedResult, Result } from "@/lib/shared/types";

function denied<T>(): Result<T> {
  return {
    success: false,
    error: "Permission denied",
    code: "PERMISSION_DENIED",
  };
}

async function canListAll(userId: string): Promise<boolean> {
  const permissionResult = await authorizationService.getUserPermissions(userId);
  const permissions = permissionResult.success ? permissionResult.data : [];
  return permissions.some(
    (permission) =>
      permission.resource === "OFF_SITE_WORK" &&
      (permission.action === "MANAGE" ||
        (permission.action === "LIST" && permission.scope === "ALL")),
  );
}

export async function listOffSiteWorks(
  filters: OffSiteWorkFilterCriteria = {},
): Promise<Result<PaginatedResult<OffSiteWorkWithRelations>>> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) return denied();

  if (await canListAll(userId)) return offSiteWorkService.list(filters);

  const allowed =
    (await can(userId, "OFF_SITE_WORK", "LIST", { targetOwnerId: userId })) ||
    (await can(userId, "OFF_SITE_WORK", "READ", { targetOwnerId: userId }));
  if (!allowed) return denied();
  // Force OWN after spreading filters so caller input can never widen the scope.
  return offSiteWorkService.list({ ...filters, postedByUserId: userId });
}

export async function getOffSiteWork(
  id: string,
): Promise<Result<OffSiteWorkWithRelations>> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) return denied();
  const targetResult = await offSiteWorkService.getById(id);
  if (!targetResult.success) {
    return {
      success: false,
      error: "ไม่พบใบนำตัว",
      code: "OFF_SITE_WORK_NOT_FOUND",
    };
  }
  const target = targetResult.data;
  if (
    !(await can(userId, "OFF_SITE_WORK", "READ", {
      targetOwnerId: target.postedByUserId,
    }))
  ) {
    return denied();
  }
  return targetResult;
}

export async function createOffSiteWork(
  data: CreateOffSiteWorkInput,
): Promise<Result<OffSiteWorkEntity>> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) return denied();
  if (
    !(await can(userId, "OFF_SITE_WORK", "CREATE", {
      targetOwnerId: userId,
    }))
  ) {
    return denied();
  }
  if (data.supersedesId) {
    const targetResult = await offSiteWorkService.getById(data.supersedesId);
    if (!targetResult.success) {
      return {
        success: false,
        error: "ไม่พบใบนำตัวต้นฉบับ",
        code: "OFF_SITE_WORK_NOT_FOUND",
      };
    }
    const target = targetResult.data;
    if (
      !(await can(userId, "OFF_SITE_WORK", "UPDATE", {
        targetOwnerId: target.postedByUserId,
      }))
    ) {
      return denied();
    }
  }
  const result = await offSiteWorkService.create(data, userId);
  if (result.success) {
    revalidatePath("/off-site-work");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function updateOffSiteWork(
  id: string,
  data: UpdateOffSiteWorkInput,
): Promise<Result<OffSiteWorkEntity>> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) return denied();
  const targetResult = await offSiteWorkService.getById(id);
  if (!targetResult.success) {
    return {
      success: false,
      error: "ไม่พบใบนำตัว",
      code: "OFF_SITE_WORK_NOT_FOUND",
    };
  }
  const target = targetResult.data;
  if (
    !(await can(userId, "OFF_SITE_WORK", "UPDATE", {
      targetOwnerId: target.postedByUserId,
    }))
  ) {
    return denied();
  }
  const result = await offSiteWorkService.update(id, data, userId);
  if (result.success) {
    revalidatePath("/off-site-work");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function deleteOffSiteWork(id: string): Promise<Result<void>> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) return denied();
  const targetResult = await offSiteWorkService.getById(id);
  if (!targetResult.success) {
    return {
      success: false,
      error: "ไม่พบใบนำตัว",
      code: "OFF_SITE_WORK_NOT_FOUND",
    };
  }
  const target = targetResult.data;
  if (
    !(await can(userId, "OFF_SITE_WORK", "DELETE", {
      targetOwnerId: target.postedByUserId,
    }))
  ) {
    return denied();
  }
  const result = await offSiteWorkService.delete(id, userId);
  if (result.success) {
    revalidatePath("/off-site-work");
    revalidatePath("/dashboard");
  }
  return result;
}
