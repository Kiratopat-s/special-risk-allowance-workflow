"use server";

import { auth } from "@/lib/auth";
import { parseAnalyticsQuery, analyticsPage } from "@/lib/domains/analytics/query";
import { analyticsService } from "@/lib/domains/analytics/service";
import type { AnalyticsClaimPage, AnalyticsReport } from "@/lib/domains/analytics/types";
import type { Result } from "@/lib/shared/types";

export async function getAnalyticsReport(query = ""): Promise<Result<AnalyticsReport>> {
  const session = await auth();
  if (!session?.user?.dbUserId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  const filters = parseAnalyticsQuery(new URLSearchParams(query));
  if (!filters.success) return filters;
  return analyticsService.getReport(filters.data);
}

export async function getAnalyticsClaims(query = "", page = 1): Promise<Result<AnalyticsClaimPage>> {
  const session = await auth();
  if (!session?.user?.dbUserId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  const filters = parseAnalyticsQuery(new URLSearchParams(query));
  if (!filters.success) return filters;
  return analyticsService.getClaims(session.user.dbUserId, filters.data, analyticsPage(page));
}
