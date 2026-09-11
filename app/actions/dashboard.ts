"use server";
import { auth } from "@/lib/auth";
import { dashboardService } from "@/lib/domains/dashboard/service";
import type { DashboardOverview } from "@/lib/domains/dashboard/types";
import type { Result } from "@/lib/shared/types";
export async function getDashboardOverview(
  month = new Date().toISOString().slice(0, 7),
): Promise<Result<DashboardOverview>> {
  const session = await auth();
  if (!session?.user?.dbUserId)
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  return dashboardService.getOverview(session.user.dbUserId, month);
}
