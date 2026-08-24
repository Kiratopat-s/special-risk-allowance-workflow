import { createHash } from "node:crypto";
import { actionLogService } from "@/lib/domains/action-log/service";
import { holidayCalendarService } from "@/lib/domains/holiday-calendar";
import { leaderVerificationService } from "@/lib/domains/leader-verification";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  ActionType,
  error,
  success,
  type PaginatedResult,
  type Result,
} from "@/lib/shared/types";
import {
  ActiveClaimExistsError,
  ClaimStateConflictError,
  expenseClaimDocumentRepository as repo,
} from "./repository";
import type {
  ClaimWorkDateInput,
  ClaimantSnapshot,
  CreateExpenseClaimDocumentInput,
  EligibleOffSiteWorkOption,
  ExpenseClaimDocumentEntity,
  ExpenseClaimDocumentFilterCriteria,
  ExpenseClaimDocumentWithRelations,
  PreparedRevision,
  PreparedWorkDate,
  UpdateExpenseClaimDocumentInput,
} from "./types";
import {
  calculateClaimAmount,
  CLAIM_DAILY_RATE,
  deriveWorkDayType,
  isValidWeSafeCode,
  normalizeWeSafeCodes,
  requiresWeSafeCode,
} from "./validation";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeMonth(value: Date | string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || isoDate(date) !== value ? null : date;
}

function profileSnapshot(
  profile: Awaited<ReturnType<typeof repo.findClaimantProfile>>,
  requireComplete: boolean,
): Result<ClaimantSnapshot> {
  if (!profile) return error("ไม่พบข้อมูลผู้ขอเบิก", "CLAIMANT_NOT_FOUND");
  const missing: string[] = [];
  const employeeId = profile.employeeId?.trim() ?? "";
  if (requireComplete && !/^[0-9]{1,6}$/.test(employeeId)) {
    missing.push("รหัสพนักงาน (ตัวเลข 1-6 หลัก)");
  }
  if (!profile.positionShort) missing.push("ชื่อตำแหน่งย่อ");
  if (!profile.departmentId || !profile.department) missing.push("หน่วยงาน");
  if (requireComplete && missing.length > 0) {
    return error(
      `ข้อมูลโปรไฟล์ไม่ครบ: ${missing.join(", ")}`,
      "INCOMPLETE_CLAIMANT_PROFILE",
    );
  }
  return success({
    employeeId: /^[0-9]{1,6}$/.test(employeeId)
      ? employeeId.padStart(6, "0")
      : employeeId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    position: profile.position,
    positionShort: profile.positionShort ?? "",
    positionLevel: profile.positionLevel,
    departmentId: profile.departmentId ?? "",
    departmentName: profile.department?.name ?? "",
    departmentShort: profile.department?.shortName ?? null,
  });
}

function materialHash(prepared: Omit<PreparedRevision, "materialHash">): string {
  const canonical = JSON.stringify({
    claimant: prepared.claimant,
    remark: prepared.remark,
    offSiteWorks: prepared.offSiteWorks
      .map((item) => ({
        ...item,
        startDate: isoDate(item.startDate),
        endDate: isoDate(item.endDate),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    workDates: prepared.workDates
      .map((item) => ({
        date: item.dateIso,
        offSiteWorkId: item.offSiteWorkId,
        dayType: item.dayType,
        holidayType: item.holidayType,
        holidayName: item.holidayName,
        holidaySource: item.holidaySource,
        requiresWeSafe: item.requiresWeSafe,
        weSafeCodes: [...item.weSafeCodes].sort(),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    ratePerDay: CLAIM_DAILY_RATE,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function currentWorkDateInputs(
  claim: ExpenseClaimDocumentWithRelations,
): ClaimWorkDateInput[] {
  return claim.currentRevision.workDates.map((item) => ({
    date: item.date,
    offSiteWorkId: item.offSiteWorkId,
    weSafeCodes: item.weSafeCodes,
  }));
}

async function prepareRevision(
  claimantId: string,
  month: Date,
  workDateInputs: ClaimWorkDateInput[],
  remark: string | null,
  requireComplete: boolean,
): Promise<Result<PreparedRevision>> {
  const claimant = profileSnapshot(
    await repo.findClaimantProfile(claimantId),
    requireComplete,
  );
  if (!claimant.success) return claimant;

  const seenDates = new Set<string>();
  for (const item of workDateInputs) {
    if (seenDates.has(item.date)) {
      return error(`เลือกวันที่ ${item.date} ซ้ำ`, "DUPLICATE_WORK_DATE");
    }
    seenDates.add(item.date);
  }
  if (requireComplete && workDateInputs.length === 0) {
    return error("กรุณาเลือกวันที่เบิกอย่างน้อย 1 วัน", "WORK_DATES_REQUIRED");
  }

  const oswIds = [...new Set(workDateInputs.map((item) => item.offSiteWorkId))];
  const offSiteWorks = await repo.findOffSiteWorksForParticipant(claimantId, oswIds);
  if (offSiteWorks.length !== oswIds.length) {
    return error(
      "ใบนำตัวบางรายการไม่มีผู้ขออยู่ในรายชื่อผู้เดินทาง",
      "CLAIMANT_NOT_PARTICIPANT",
    );
  }
  const oswById = new Map(offSiteWorks.map((item) => [item.id, item]));

  const parsedDates: Array<{
    input: ClaimWorkDateInput;
    date: Date;
    codes: string[];
  }> = [];
  for (const input of workDateInputs) {
    const date = parseIsoDate(input.date);
    if (!date) return error(`วันที่ไม่ถูกต้อง: ${input.date}`, "INVALID_WORK_DATE");
    if (
      date.getUTCFullYear() !== month.getUTCFullYear() ||
      date.getUTCMonth() !== month.getUTCMonth()
    ) {
      return error(`วันที่ ${input.date} ไม่อยู่ในเดือนที่เบิก`, "DATE_OUTSIDE_MONTH");
    }
    const osw = oswById.get(input.offSiteWorkId);
    if (!osw) return error("ไม่พบใบนำตัวหลัก", "OFF_SITE_WORK_NOT_FOUND");
    if (date < osw.startDate || date > osw.endDate) {
      return error(
        `วันที่ ${input.date} ไม่อยู่ในช่วงของใบนำตัว ${osw.innerRefDocumentId ?? osw.id}`,
        "DATE_OUTSIDE_OSW",
      );
    }
    const codes = normalizeWeSafeCodes(input.weSafeCodes);
    if (requireComplete) {
      for (const code of codes) {
        if (!isValidWeSafeCode(code)) {
          return error(
            `รหัส We Safe ต้องมีทั้งหมด 19 ตัวอักษร (หลังตัดช่องว่างหัวท้าย)`,
            "INVALID_WE_SAFE_CODE",
          );
        }
      }
    }
    parsedDates.push({ input, date, codes });
  }

  const holidayMap = await holidayCalendarService.resolveDates(
    parsedDates.map((item) => item.input.date),
  );
  const workDates: PreparedWorkDate[] = parsedDates.map(({ input, date, codes }) => {
    const holiday = holidayMap.get(input.date)!;
    const osw = oswById.get(input.offSiteWorkId)!;
    const dayType = deriveWorkDayType(
      input.date,
      isoDate(osw.startDate),
      isoDate(osw.endDate),
    );
    const requiresWeSafe = requiresWeSafeCode(dayType, holiday.holidayType);
    return {
      date,
      dateIso: input.date,
      offSiteWorkId: input.offSiteWorkId,
      dayType,
      holidayType: holiday.holidayType,
      holidayName: holiday.holidayName,
      holidaySource: holiday.holidaySource,
      requiresWeSafe,
      weSafeCodes: codes,
    };
  });

  if (requireComplete) {
    for (const item of workDates) {
      if (item.requiresWeSafe && item.weSafeCodes.length === 0) {
        return error(
          `วันที่ ${item.dateIso} ต้องมีรหัส We Safe อย่างน้อย 1 รหัส`,
          "WE_SAFE_REQUIRED",
        );
      }
    }
    const leaderless = offSiteWorks.filter(
      (item) =>
        (!item.leaderUserId && !item.leaderEmail) ||
        !item.leaderFirstName ||
        !item.leaderLastName,
    );
    if (leaderless.length > 0) {
      return error(
        `ใบนำตัวต่อไปนี้ยังไม่มีหัวหน้าชุด: ${leaderless
          .map((item) => item.innerRefDocumentId ?? item.id)
          .join(", ")}`,
        "OSW_MISSING_LEADER",
      );
    }
  }

  const preparedWithoutHash: Omit<PreparedRevision, "materialHash"> = {
    claimant: claimant.data,
    remark: remark?.trim() || null,
    workDates: workDates.sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    offSiteWorks: offSiteWorks.map((item) => ({
      id: item.id,
      innerRefDocumentId: item.innerRefDocumentId,
      startDate: item.startDate,
      endDate: item.endDate,
      objective: item.objective,
      location: item.location,
      leaderUserId: item.leaderUserId,
      leaderEmpId: item.leaderEmpId,
      leaderFirstName: item.leaderFirstName ?? "",
      leaderLastName: item.leaderLastName ?? "",
      leaderPosition: item.leaderPosition,
      leaderEmail: item.leaderEmail,
    })),
    totalDays: workDates.length,
    totalAmount: calculateClaimAmount(workDates.length),
  };
  return success({
    ...preparedWithoutHash,
    materialHash: materialHash(preparedWithoutHash),
  });
}

async function logClaim(
  actorId: string,
  actionType: ActionType,
  claim: ExpenseClaimDocumentEntity,
  description: string,
) {
  await actionLogService.log({
    userId: actorId,
    actionType,
    actionDescription: description,
    targetEntityType: "ExpenseClaim",
    targetEntityId: claim.id,
    newData: {
      status: claim.status,
      revisionNo: claim.currentRevisionNo,
      totalDays: claim.countDates,
      totalAmount: claim.amount,
    } as Prisma.JsonObject,
  });
}

class VerificationCreationError extends Error {
  constructor(
    message: string,
    readonly resultCode?: string,
  ) {
    super(message);
    this.name = "VerificationCreationError";
  }
}

export const expenseClaimDocumentService = {
  async listEligibleOffSiteWorksForUser(
    userId: string,
    month: Date,
  ): Promise<Result<EligibleOffSiteWorkOption[]>> {
    return success(await repo.findEligibleOffSiteWorksForUser(userId, month));
  },

  async saveClaimDraft(
    input: CreateExpenseClaimDocumentInput | UpdateExpenseClaimDocumentInput,
    actorId: string,
    claimantId: string,
    claimId?: string,
  ): Promise<Result<ExpenseClaimDocumentEntity>> {
    if (!claimId) {
      return this.create(
        input as CreateExpenseClaimDocumentInput,
        actorId,
        claimantId,
      );
    }
    const existing = await repo.findWithRelations(claimId);
    if (!existing) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    if (existing.status !== "DRAFT") {
      return error(
        "คำขอที่ส่งแล้วต้องเริ่ม revision แก้ไขก่อน",
        "CORRECTION_REQUIRED",
      );
    }
    return this.update(claimId, input as UpdateExpenseClaimDocumentInput, actorId);
  },

  async startClaimCorrection(
    id: string,
    input: UpdateExpenseClaimDocumentInput,
    actorId: string,
  ): Promise<Result<ExpenseClaimDocumentEntity>> {
    const existing = await repo.findWithRelations(id);
    if (!existing) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    if (existing.status === "DRAFT") {
      return error("คำขอยังเป็นฉบับร่าง", "CLAIM_ALREADY_DRAFT");
    }
    return this.update(id, input, actorId);
  },

  async submitClaim(
    id: string,
    actorId: string,
  ): Promise<Result<ExpenseClaimDocumentEntity>> {
    const existing = await repo.findWithRelations(id);
    if (!existing) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    if (existing.currentRevisionNo !== 1) {
      return error("revision แก้ไขต้องใช้คำสั่งส่งซ้ำ", "RESUBMIT_REQUIRED");
    }
    return this.submitDraft(id, actorId);
  },

  async resubmitClaim(
    id: string,
    actorId: string,
  ): Promise<Result<ExpenseClaimDocumentEntity>> {
    const existing = await repo.findWithRelations(id);
    if (!existing) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    if (existing.currentRevisionNo <= 1) {
      return error("คำขอนี้ยังไม่ใช่ revision แก้ไข", "NOT_A_CORRECTION");
    }
    return this.submitDraft(id, actorId);
  },

  async cancelClaim(id: string, actorId: string): Promise<Result<void>> {
    return this.delete(id, actorId);
  },

  async getById(
    id: string,
    includeCancelled = false,
  ): Promise<Result<ExpenseClaimDocumentWithRelations>> {
    const claim = await repo.findWithRelations(id, includeCancelled);
    return claim ? success(claim) : error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
  },

  async create(
    input: CreateExpenseClaimDocumentInput,
    actorId: string,
    claimantId: string,
  ): Promise<Result<ExpenseClaimDocumentEntity>> {
    const month = normalizeMonth(input.expenseMonth);
    if (!month) return error("เดือนที่เบิกไม่ถูกต้อง", "INVALID_EXPENSE_MONTH");
    if (await repo.findActiveForUserMonth(claimantId, month)) {
      return error(
        "มีคำขอที่ยังใช้งานอยู่สำหรับเดือนนี้แล้ว กรุณาแก้ไขคำขอเดิม",
        "ACTIVE_CLAIM_EXISTS",
      );
    }
    const prepared = await prepareRevision(
      claimantId,
      month,
      input.workDates,
      input.remark ?? null,
      false,
    );
    if (!prepared.success) return prepared;

    let claim: ExpenseClaimDocumentEntity;
    try {
      claim = await repo.createDraft(month, claimantId, actorId, prepared.data);
    } catch (cause) {
      if (cause instanceof ActiveClaimExistsError) {
        return error(
          "มีคำขอที่ยังใช้งานอยู่สำหรับเดือนนี้แล้ว กรุณาแก้ไขคำขอเดิม",
          "ACTIVE_CLAIM_EXISTS",
        );
      }
      throw cause;
    }
    await logClaim(
      actorId,
      ActionType.CLAIM_DRAFT_SAVED,
      claim,
      `Expense claim "${claim.id}" draft saved`,
    );

    return success(claim, "บันทึกคำขอเรียบร้อย");
  },

  async update(
    id: string,
    input: UpdateExpenseClaimDocumentInput,
    actorId: string,
  ): Promise<Result<ExpenseClaimDocumentEntity>> {
    const existing = await repo.findWithRelations(id);
    if (!existing) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    if (existing.status === "COLLECTED" || existing.status === "COMPLETED") {
      return error("คำขอที่รวบรวมหรือเสร็จสิ้นแล้วแก้ไขไม่ได้", "CLAIM_IMMUTABLE");
    }
    if (existing.status === "CANCELLED") {
      return error("คำขอถูกยกเลิกแล้ว", "CLAIM_CANCELLED");
    }
    const month = normalizeMonth(input.expenseMonth ?? existing.expenseMonth);
    if (!month || isoDate(month) !== isoDate(existing.expenseMonth)) {
      return error("ไม่สามารถเปลี่ยนเดือนของคำขอเดิม", "EXPENSE_MONTH_IMMUTABLE");
    }
    const prepared = await prepareRevision(
      existing.userId,
      month,
      input.workDates,
      input.remark !== undefined ? input.remark : existing.remark,
      false,
    );
    if (!prepared.success) return prepared;

    let updated: ExpenseClaimDocumentEntity;
    try {
      if (existing.status === "DRAFT") {
        updated = await repo.updateDraftRevision(
          existing.id,
          existing.currentRevision.id,
          prepared.data,
        );
        await logClaim(
          actorId,
          ActionType.CLAIM_DRAFT_SAVED,
          updated,
          `Expense claim "${id}" draft updated`,
        );
      } else {
        updated = await repo.startCorrectionRevision(
          existing.id,
          existing.currentRevision.id,
          existing.currentRevisionNo + 1,
          prepared.data,
        );
        await logClaim(
          actorId,
          ActionType.CLAIM_CORRECTION_STARTED,
          updated,
          `Expense claim "${id}" correction revision started`,
        );
      }
    } catch (cause) {
      if (cause instanceof ClaimStateConflictError) {
        return error("สถานะคำขอเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่", "CLAIM_CONFLICT");
      }
      throw cause;
    }
    return success(updated, "แก้ไขคำขอเรียบร้อย");
  },

  async submitDraft(
    id: string,
    actorId: string,
  ): Promise<Result<ExpenseClaimDocumentEntity>> {
    const existing = await repo.findWithRelations(id);
    if (!existing) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    if (existing.status !== "DRAFT" || existing.currentRevision.status !== "DRAFT") {
      return error("ส่งได้เฉพาะคำขอฉบับร่าง", "CLAIM_NOT_DRAFT");
    }
    const prepared = await prepareRevision(
      existing.userId,
      existing.expenseMonth,
      currentWorkDateInputs(existing),
      existing.remark,
      true,
    );
    if (!prepared.success) return prepared;

    try {
      const created = await repo.submitDraftAtomic(
        existing.id,
        existing.currentRevision.id,
        prepared.data,
        async (tx) => {
          const result =
            await leaderVerificationService.createForRevisionInTransaction(
              tx,
              existing.currentRevision.id,
            );
          if (!result.success) {
            throw new VerificationCreationError(result.error, result.code);
          }
          return result.data;
        },
      );
      leaderVerificationService.notifyCreated(created);
    } catch (cause) {
      if (cause instanceof VerificationCreationError) {
        return error(cause.message, cause.resultCode ?? "VERIFICATION_CREATE_FAILED");
      }
      if (cause instanceof ClaimStateConflictError) {
        return error("สถานะคำขอเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่", "CLAIM_CONFLICT");
      }
      throw cause;
    }

    const updated = (await repo.findById(id))!;
    await logClaim(
      actorId,
      existing.currentRevisionNo === 1
        ? ActionType.CLAIM_SUBMITTED
        : ActionType.CLAIM_RESUBMITTED,
      updated,
      `Expense claim "${id}" revision ${existing.currentRevisionNo} submitted`,
    );
    return success(updated, "ส่งคำขอให้หัวหน้าชุดยืนยันแล้ว");
  },

  async delete(id: string, actorId: string): Promise<Result<void>> {
    const existing = await repo.findById(id);
    if (!existing) return error("ไม่พบคำขอเบิก", "CLAIM_NOT_FOUND");
    if (existing.status === "COLLECTED" || existing.status === "COMPLETED") {
      return error("คำขอที่รวบรวมหรือเสร็จสิ้นแล้วไม่สามารถยกเลิก", "CLAIM_IMMUTABLE");
    }
    try {
      await repo.cancelAtomic(id);
    } catch (cause) {
      if (cause instanceof ClaimStateConflictError) {
        return error("สถานะคำขอไม่อนุญาตให้ยกเลิก", "CLAIM_CONFLICT");
      }
      throw cause;
    }
    await actionLogService.log({
      userId: actorId,
      actionType: ActionType.CLAIM_CANCELLED,
      actionDescription: `Expense claim "${id}" cancelled`,
      targetEntityType: "ExpenseClaim",
      targetEntityId: id,
    });
    return success(undefined, "ยกเลิกคำขอเรียบร้อย");
  },

  async list(
    criteria: ExpenseClaimDocumentFilterCriteria,
  ): Promise<Result<PaginatedResult<ExpenseClaimDocumentWithRelations>>> {
    return success(await repo.findMany(criteria));
  },
};
