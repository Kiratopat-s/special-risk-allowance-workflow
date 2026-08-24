import type { HolidayType, WorkDayType } from "@/lib/shared/types";

export const CLAIM_DAILY_RATE = 150;

export function normalizeWeSafeCodes(codes: string[] | undefined): string[] {
  return (codes ?? []).map((code) => code.trim());
}

export function isValidWeSafeCode(code: string): boolean {
  return code.trim().length === 19;
}

export function deriveWorkDayType(
  workDate: string,
  offSiteWorkStartDate: string,
  offSiteWorkEndDate: string,
): WorkDayType {
  return workDate === offSiteWorkStartDate || workDate === offSiteWorkEndDate
    ? "TRAVEL"
    : "DUTY";
}

export function requiresWeSafeCode(
  dayType: WorkDayType,
  holidayType: HolidayType,
): boolean {
  return (
    dayType === "TRAVEL" ||
    holidayType === "WEEKEND" ||
    holidayType === "PUBLIC_HOLIDAY"
  );
}

export function calculateClaimAmount(dayCount: number): number {
  if (!Number.isInteger(dayCount) || dayCount < 0) {
    throw new Error("dayCount must be a non-negative integer");
  }
  return dayCount * CLAIM_DAILY_RATE;
}
