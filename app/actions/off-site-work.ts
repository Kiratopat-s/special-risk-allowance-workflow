"use server";

/**
 * OffSiteWork Server Actions
 *
 * Server actions for managing off-site work records
 *
 * @module app/actions/off-site-work
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { offSiteWorkService } from "@/lib/domains/off-site-work";
import type { Result, PaginatedResult } from "@/lib/shared/types";
import type {
  OffSiteWorkEntity,
  OffSiteWorkWithRelations,
  CreateOffSiteWorkInput,
  UpdateOffSiteWorkInput,
  OffSiteWorkFilterCriteria,
} from "@/lib/domains/off-site-work";

/**
 * List off-site work records with filters and pagination
 */
export async function listOffSiteWorks(
  filters?: OffSiteWorkFilterCriteria
): Promise<Result<PaginatedResult<OffSiteWorkWithRelations>>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const canList = await can(session.user.dbUserId, "OFF_SITE_WORK", "LIST");
  if (!canList) {
    // User can only see own records
    const canReadOwn = await can(
      session.user.dbUserId,
      "OFF_SITE_WORK",
      "READ"
    );
    if (!canReadOwn) {
      return {
        success: false,
        error: "Permission denied",
        code: "PERMISSION_DENIED",
      };
    }
    // Restrict to own records
    return offSiteWorkService.list({
      ...filters,
      postedByUserId: session.user.dbUserId,
    });
  }

  return offSiteWorkService.list(filters ?? {});
}

/**
 * Get off-site work by ID
 */
export async function getOffSiteWork(
  id: string
): Promise<Result<OffSiteWorkWithRelations>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const canRead = await can(session.user.dbUserId, "OFF_SITE_WORK", "READ");
  if (!canRead) {
    return {
      success: false,
      error: "Permission denied",
      code: "PERMISSION_DENIED",
    };
  }

  return offSiteWorkService.getById(id);
}

/**
 * Create a new off-site work record
 */
export async function createOffSiteWork(
  data: CreateOffSiteWorkInput
): Promise<Result<OffSiteWorkEntity>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const canCreate = await can(
    session.user.dbUserId,
    "OFF_SITE_WORK",
    "CREATE"
  );
  if (!canCreate) {
    return {
      success: false,
      error: "Permission denied",
      code: "PERMISSION_DENIED",
    };
  }

  const result = await offSiteWorkService.create(data, session.user.dbUserId);
  if (result.success) {
    revalidatePath("/off-site-work");
    revalidatePath("/dashboard");
  }
  return result;
}

/**
 * Update an off-site work record
 */
export async function updateOffSiteWork(
  id: string,
  data: UpdateOffSiteWorkInput
): Promise<Result<OffSiteWorkEntity>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const canUpdate = await can(
    session.user.dbUserId,
    "OFF_SITE_WORK",
    "UPDATE"
  );
  if (!canUpdate) {
    return {
      success: false,
      error: "Permission denied",
      code: "PERMISSION_DENIED",
    };
  }

  const result = await offSiteWorkService.update(id, data, session.user.dbUserId);
  if (result.success) {
    revalidatePath("/off-site-work");
    revalidatePath("/dashboard");
  }
  return result;
}

/**
 * Soft-delete an off-site work record
 */
export async function deleteOffSiteWork(
  id: string
): Promise<Result<void>> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const canDelete = await can(
    session.user.dbUserId,
    "OFF_SITE_WORK",
    "DELETE"
  );
  if (!canDelete) {
    return {
      success: false,
      error: "Permission denied",
      code: "PERMISSION_DENIED",
    };
  }

  const result = await offSiteWorkService.delete(id, session.user.dbUserId);
  if (result.success) {
    revalidatePath("/off-site-work");
    revalidatePath("/dashboard");
  }
  return result;
}
