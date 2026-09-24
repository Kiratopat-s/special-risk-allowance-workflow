import { CLAIM_DAILY_RATE, isClaimMutationLocked } from "@/lib/shared/claim-mutation";
import { error, success, type Result } from "@/lib/shared/types";
import type { ClaimDocumentStatus } from "@/lib/shared/types";
import type { EligibleOffSiteWorkOption } from "./types";

export interface ClaimSelection {
  expenseMonth: Date;
  selectedDates: string[];
  offSiteWorkIds: string[];
  countDates: number;
  amount: number;
}

/** The chosen calendar dates are the sole source of payable days and money. */
export function normalizeClaimSelection(input: {
  expenseMonth: Date | string;
  selectedDates?: unknown;
  offSiteWorkIds?: unknown;
}, eligibleWorks: EligibleOffSiteWorkOption[], submitted: boolean): Result<ClaimSelection> {
  const month = new Date(input.expenseMonth);
  if (!Number.isFinite(month.getTime())) {
    return error("เดือนที่ขอเบิกไม่ถูกต้อง", "INVALID_EXPENSE_MONTH");
  }
  const expenseMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const dates = input.selectedDates ?? [];
  const workIds = input.offSiteWorkIds ?? [];
  if (!Array.isArray(dates) || dates.some((date) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date;
  })) {
    return error("วันที่เลือกไม่ถูกต้อง กรุณาเลือกวันที่จากปฏิทิน", "INVALID_SELECTED_DATES");
  }
  if (!Array.isArray(workIds) || workIds.some((id) => typeof id !== "string" || !id.trim())) {
    return error("ใบสั่งปฏิบัติงานที่เลือกไม่ถูกต้อง", "INVALID_OFF_SITE_WORKS");
  }
  const selectedDates = [...new Set(dates as string[])].sort();
  const offSiteWorkIds = [...new Set(workIds as string[])].sort();
  if (selectedDates.some((date) => date.slice(0, 7) !== expenseMonth.toISOString().slice(0, 7))) {
    return error("วันที่เลือกต้องอยู่ในเดือนที่ขอเบิก", "SELECTED_DATE_OUTSIDE_MONTH");
  }
  const works = offSiteWorkIds.map((id) => eligibleWorks.find((work) => work.id === id));
  if (works.some((work) => !work)) {
    return error("มีใบสั่งปฏิบัติงานที่ไม่สามารถใช้เบิกได้ในเดือนนี้ กรุณาเลือกใหม่", "INELIGIBLE_OFF_SITE_WORK");
  }
  const selectedWorks = works as EligibleOffSiteWorkOption[];
  if (selectedDates.some((date) => !selectedWorks.some((work) => {
    const start = new Date(work.startDate).toISOString().slice(0, 10);
    const end = new Date(work.endDate).toISOString().slice(0, 10);
    return date >= start && date <= end;
  }))) {
    return error("วันที่เลือกต้องอยู่ในช่วงของใบสั่งปฏิบัติงานที่เลือก", "SELECTED_DATE_OUTSIDE_WORK");
  }
  if (submitted && selectedWorks.some((work) => !work.hasLeader)) {
    return error("กรุณากำหนดหัวหน้าให้ครบทุกใบสั่งปฏิบัติงานก่อนส่งเอกสาร", "OSW_MISSING_LEADER");
  }
  if (submitted && (!offSiteWorkIds.length || !selectedDates.length)) {
    return error("กรุณาเลือกใบสั่งปฏิบัติงานและวันที่ขอเบิกอย่างน้อย 1 วัน", "CLAIM_SELECTION_REQUIRED");
  }
  return success({ expenseMonth, selectedDates, offSiteWorkIds,
    countDates: selectedDates.length, amount: selectedDates.length * CLAIM_DAILY_RATE });
}

export function claimSelectionChanged(existing: {
  expenseMonth: Date;
  selectedDates: unknown;
  offSiteWorkIds: string[];
  countDates: unknown;
  amount: unknown;
}, selection: ClaimSelection): boolean {
  const previousDates = Array.isArray(existing.selectedDates) ? existing.selectedDates : [];
  return existing.expenseMonth.toISOString().slice(0, 7) !== selection.expenseMonth.toISOString().slice(0, 7) ||
    JSON.stringify([...new Set(previousDates)].sort()) !== JSON.stringify(selection.selectedDates) ||
    JSON.stringify([...new Set(existing.offSiteWorkIds)].sort()) !== JSON.stringify(selection.offSiteWorkIds) ||
    Number(existing.countDates ?? 0) !== selection.countDates || Number(existing.amount ?? 0) !== selection.amount;
}

export function requireEditableClaim(claim: {
  status: ClaimDocumentStatus;
  monthlyRequestCollectionId?: string | null;
  cancelledAt?: Date | null;
}): Result<void> {
  if (isClaimMutationLocked(claim) || claim.cancelledAt) {
    return error("เอกสารนี้ถูกล็อกแล้ว หากรวบรวมแล้วต้องนำออกจากรายการรวบรวมก่อนแก้ไขหรือยกเลิก", "CLAIM_LOCKED");
  }
  return success(undefined);
}
