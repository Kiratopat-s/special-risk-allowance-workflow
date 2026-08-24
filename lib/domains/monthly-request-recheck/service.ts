import { notificationService } from "@/lib/domains/notification";
import { error, success, type Result } from "@/lib/shared/types";
import { monthlyRequestRecheckRepository as repo } from "./repository";
import {
  analyzeRecheckDatePatterns,
  calculateRecheckMetrics,
  classifyRecheckClaimGroup,
  getPassBlockedReasons,
  isRejectEligible,
  isRemoveEligible,
} from "./logic";
import type {
  FlagClaimInput,
  MonthlyRequestRecheckDetail,
  MonthlyRequestRecheckOverview,
  RecheckClaimGroup,
  RecheckClaimRow,
  RecheckDateComparison,
  RecheckMetrics,
  RecheckMutationResult,
  RejectClaimInput,
  RemoveCollectedClaimInput,
  ResolveClaimFlagInput,
} from "./types";

type MonthClaim = Awaited<ReturnType<typeof repo.findClaimsForMonth>>[number];
type CurrentRevision = MonthClaim["revisions"][number];
type ScopedClaim = { claim: MonthClaim; revision: CurrentRevision };

const THAI_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function parseMonth(value: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthRange(value: string): { start: Date; end: Date } | null {
  const start = parseMonth(value);
  if (!start) return null;
  return {
    start,
    end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
  };
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function currentRevision(claim: MonthClaim): CurrentRevision | null {
  return claim.revisions.find((item) => item.revisionNo === claim.currentRevisionNo) ?? null;
}

function claimGroup(claim: MonthClaim): RecheckClaimGroup {
  return classifyRecheckClaimGroup(claim.status, Boolean(claim.cancelledAt));
}

function metrics(
  participantIds: Set<string>,
  claims: ScopedClaim[],
  offSiteWorkId?: string,
): RecheckMetrics {
  return calculateRecheckMetrics(
    participantIds,
    claims.map(({ claim, revision }) => ({
      id: claim.id,
      userId: claim.userId,
      status: claim.status,
      cancelled: Boolean(claim.cancelledAt),
      verificationTotal: revision.offSiteWorks.length,
      verificationConfirmed: revision.offSiteWorks.filter(
        (offSiteWork) => offSiteWork.leaderVerification?.status === "CONFIRMED",
      ).length,
      pendingLeaderForScope: offSiteWorkId
        ? revision.offSiteWorks.some(
            (offSiteWork) =>
              offSiteWork.offSiteWorkId === offSiteWorkId &&
              offSiteWork.leaderVerification?.status !== "CONFIRMED",
          )
        : revision.offSiteWorks.length === 0 ||
          revision.offSiteWorks.some(
            (offSiteWork) => offSiteWork.leaderVerification?.status !== "CONFIRMED",
          ),
      hasActiveMonthlyRequestItem: claim.monthlyRequestItems.length > 0,
      hasOpenSuspiciousFlag: claim.reviewFlags.some((flag) => flag.status === "OPEN"),
    })),
  );
}

function scopedClaims(
  claims: MonthClaim[],
  departmentId?: string | null,
): ScopedClaim[] {
  return claims.flatMap((claim) => {
    const revision = currentRevision(claim);
    if (!revision) return [];
    if (departmentId && revision.departmentIdSnapshot !== departmentId) return [];
    return [{ claim, revision }];
  });
}

function datePatternForOffSiteWork(
  claims: ScopedClaim[],
  offSiteWorkId: string,
) {
  const comparableClaims = claims.filter(
    ({ claim }) =>
      claim.status !== "DRAFT" &&
      claim.status !== "CANCELLED" &&
      !claim.cancelledAt,
  );
  const analysis = analyzeRecheckDatePatterns(
    comparableClaims.map(({ claim, revision }) => ({
      id: claim.id,
      dates: revision.workDates
        .filter(
          (date) => date.revisionOffSiteWork.offSiteWorkId === offSiteWorkId,
        )
        .map((date) => toIsoDate(date.workDate)),
    })),
  );
  const attentionClaimIds = new Set<string>();
  for (const { claim, revision } of comparableClaims) {
    if (analysis?.comparisons.get(claim.id)?.differsFromMajority) {
      attentionClaimIds.add(claim.id);
    }
    const hasDuplicateWeSafe = revision.workDates.some(
      (date) =>
        date.revisionOffSiteWork.offSiteWorkId === offSiteWorkId &&
        date.weSafeCodes.length > 1 &&
        new Set(date.weSafeCodes.map((code) => code.code)).size <
          date.weSafeCodes.length,
    );
    if (hasDuplicateWeSafe) attentionClaimIds.add(claim.id);
  }
  return { analysis, attentionCueCount: attentionClaimIds.size };
}

function mapFlag(flag: MonthClaim["reviewFlags"][number]) {
  return {
    id: flag.id,
    status: flag.status,
    note: flag.note,
    openedByName: `${flag.openedBy.firstName} ${flag.openedBy.lastName}`.trim(),
    openedAt: flag.openedAt.toISOString(),
    resolutionNote: flag.resolutionNote,
    resolvedByName: flag.resolvedBy
      ? `${flag.resolvedBy.firstName} ${flag.resolvedBy.lastName}`.trim()
      : null,
    resolvedAt: flag.resolvedAt?.toISOString() ?? null,
  };
}

function mapClaimRow(
  item: ScopedClaim,
  offSiteWorkId: string,
  dateComparison: RecheckDateComparison | null,
): RecheckClaimRow {
  const { claim, revision } = item;
  const group = claimGroup(claim);
  const confirmed = revision.offSiteWorks.filter(
    (offSiteWork) => offSiteWork.leaderVerification?.status === "CONFIRMED",
  ).length;
  const pending = revision.offSiteWorks.length - confirmed;
  const openFlags = claim.reviewFlags.filter((flag) => flag.status === "OPEN");
  const membership = claim.monthlyRequestItems[0]?.monthlyRequestCollection ?? null;
  const allDates = revision.workDates.map((date) => ({
    isoDate: toIsoDate(date.workDate),
    dayType: date.dayType,
    holidayType: date.holidayType,
    holidayName: date.holidayName,
    requiresWeSafe: date.requiresWeSafe,
    hasWeSafeCode: date.weSafeCodes.length > 0,
    weSafeCodes: date.weSafeCodes.map((code) => code.code),
    offSiteWorkId: date.revisionOffSiteWork.offSiteWorkId,
    offSiteWorkReferenceNo:
      date.revisionOffSiteWork.innerRefDocumentIdSnapshot ??
      date.revisionOffSiteWork.offSiteWorkId,
  }));
  const passBlockedReasons = getPassBlockedReasons({
    status: claim.status,
    monthMatches: true,
    revisionMatches: true,
    linkedOffSiteWorkCount: revision.offSiteWorks.length,
    confirmedOffSiteWorkCount: confirmed,
    hasOpenSuspiciousFlag: openFlags.length > 0,
    hasActiveMonthlyRequestItem: Boolean(membership),
  });
  const duplicateWeSafeDates = allDates
    .filter(
      (date) =>
        date.weSafeCodes.length > 1 &&
        new Set(date.weSafeCodes).size < date.weSafeCodes.length,
    )
    .map((date) => date.isoDate);

  return {
    id: claim.id,
    group,
    status: claim.status,
    employeeId: revision.employeeIdSnapshot,
    firstName: revision.firstNameSnapshot,
    lastName: revision.lastNameSnapshot,
    positionShort: revision.positionShortSnapshot,
    positionLevel: revision.positionLevelSnapshot,
    departmentName: revision.departmentNameSnapshot,
    totalDays: revision.totalDays,
    totalAmount: revision.totalAmount.toFixed(2),
    remark: revision.remark,
    rejectionReason: claim.rejectionReason,
    revisionNo: revision.revisionNo,
    linkedOffSiteWorkCount: revision.offSiteWorks.length,
    linkedOffSiteWorks: revision.offSiteWorks.map((offSiteWork) => ({
      id: offSiteWork.offSiteWorkId,
      referenceNo:
        offSiteWork.innerRefDocumentIdSnapshot ?? offSiteWork.offSiteWorkId,
      verificationStatus: offSiteWork.leaderVerification?.status ?? null,
    })),
    verification: {
      total: revision.offSiteWorks.length,
      confirmed,
      pending,
    },
    dates: allDates.filter((date) => date.offSiteWorkId === offSiteWorkId),
    allDates,
    dateComparison,
    duplicateWeSafeDates,
    openFlags: openFlags.map(mapFlag),
    resolvedFlags: claim.reviewFlags
      .filter((flag) => flag.status === "RESOLVED")
      .map(mapFlag),
    monthlyRequest: membership,
    canPass: passBlockedReasons.length === 0,
    passBlockedReasons,
    canReject:
      group === "ACTIVE" && isRejectEligible(claim.status, membership?.status ?? null),
    canRemove: isRemoveEligible(claim.status, membership?.status ?? null),
  };
}

function toMutationResult(outcome: Awaited<ReturnType<typeof repo.passClaim>>): Result<RecheckMutationResult> {
  if (!outcome.ok || !outcome.claimId) {
    return error(outcome.message ?? "ไม่สามารถทำรายการได้", outcome.code ?? "RECHECK_ACTION_FAILED");
  }
  return success(
    {
      claimId: outcome.claimId,
      monthlyRequestId: outcome.monthlyRequestId,
      batchNo: outcome.batchNo,
    },
    "บันทึกสำเร็จ",
  );
}

function dbErrorCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("code" in value)) return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export const monthlyRequestRecheckService = {
  async getOverview(
    month: string,
    departmentId?: string | null,
  ): Promise<Result<MonthlyRequestRecheckOverview>> {
    const range = monthRange(month);
    if (!range) return error("รูปแบบเดือนต้องเป็น YYYY-MM", "INVALID_MONTH");

    const [departments, offSiteWorks, claims] = await Promise.all([
      repo.listDepartments(),
      repo.findOverlappingOffSiteWorks(range.start, range.end),
      repo.findClaimsForMonth(range.start, range.end),
    ]);
    if (departmentId && !departments.some((department) => department.id === departmentId)) {
      return error("ไม่พบหน่วยงานที่เลือก", "DEPARTMENT_NOT_FOUND");
    }

    const inScope = scopedClaims(claims, departmentId);
    const rows = offSiteWorks.flatMap((offSiteWork) => {
      const participants = offSiteWork.participants.filter(
        (participant) => !departmentId || participant.departmentIdSnapshot === departmentId,
      );
      const linkedClaims = inScope.filter(({ revision }) =>
        revision.offSiteWorks.some((item) => item.offSiteWorkId === offSiteWork.id),
      );
      if (offSiteWork.deletedAt && linkedClaims.length === 0) return [];
      if (departmentId && participants.length === 0 && linkedClaims.length === 0) return [];
      const participantIds = new Set(participants.map((participant) => participant.userId));
      const { attentionCueCount } = datePatternForOffSiteWork(
        linkedClaims,
        offSiteWork.id,
      );
      return [
        {
          id: offSiteWork.id,
          referenceNo: offSiteWork.innerRefDocumentId ?? offSiteWork.id,
          startDate: toIsoDate(offSiteWork.startDate),
          endDate: toIsoDate(offSiteWork.endDate),
          objective: offSiteWork.objective,
          location: offSiteWork.location,
          archived: Boolean(offSiteWork.deletedAt),
          participantCount: participantIds.size,
          comparisonCueCount: attentionCueCount,
          metrics: metrics(participantIds, linkedClaims, offSiteWork.id),
        },
      ];
    });

    const visibleIds = new Set(rows.map((row) => row.id));
    const allParticipants = new Set(
      offSiteWorks.flatMap((offSiteWork) =>
        visibleIds.has(offSiteWork.id)
          ? offSiteWork.participants
              .filter(
                (participant) =>
                  !departmentId || participant.departmentIdSnapshot === departmentId,
              )
              .map((participant) => participant.userId)
          : [],
      ),
    );
    const allLinkedClaims = inScope.filter(({ revision }) =>
      revision.offSiteWorks.some((offSiteWork) => visibleIds.has(offSiteWork.offSiteWorkId)),
    );

    return success({
      month,
      departmentId: departmentId ?? null,
      departments,
      totals: metrics(allParticipants, allLinkedClaims),
      offSiteWorks: rows,
    });
  },

  async getOffSiteWorkDetail(
    offSiteWorkId: string,
    month: string,
    departmentId?: string | null,
  ): Promise<Result<MonthlyRequestRecheckDetail>> {
    const range = monthRange(month);
    if (!range) return error("รูปแบบเดือนต้องเป็น YYYY-MM", "INVALID_MONTH");

    const [offSiteWorks, claims] = await Promise.all([
      repo.findOverlappingOffSiteWorks(range.start, range.end),
      repo.findClaimsForMonth(range.start, range.end),
    ]);
    const offSiteWork = offSiteWorks.find((item) => item.id === offSiteWorkId);
    if (!offSiteWork) {
      return error("ไม่พบใบนำตัวในเดือนที่เลือก", "OFF_SITE_WORK_NOT_FOUND");
    }

    const participants = offSiteWork.participants.filter(
      (participant) => !departmentId || participant.departmentIdSnapshot === departmentId,
    );
    const participantIds = new Set(participants.map((participant) => participant.userId));
    const linkedClaims = scopedClaims(claims, departmentId).filter(({ revision }) =>
      revision.offSiteWorks.some((item) => item.offSiteWorkId === offSiteWork.id),
    );
    if (offSiteWork.deletedAt && linkedClaims.length === 0) {
      return error("ไม่พบประวัติคำขอของใบนำตัวที่เก็บถาวร", "OFF_SITE_WORK_NOT_FOUND");
    }
    const days = Array.from(
      { length: new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1, 0)).getUTCDate() },
      (_, index) => {
        const date = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), index + 1));
        return {
          isoDate: toIsoDate(date),
          dayNumber: index + 1,
          shortName: THAI_WEEKDAYS[date.getUTCDay()],
          isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
        };
      },
    );
    const { analysis: datePatternAnalysis } = datePatternForOffSiteWork(
      linkedClaims,
      offSiteWork.id,
    );
    const claimRows = linkedClaims
      .map((item) =>
        mapClaimRow(
          item,
          offSiteWork.id,
          datePatternAnalysis?.comparisons.get(item.claim.id) ?? null,
        ),
      )
      .sort((left, right) => {
        const leftPriority =
          (left.openFlags.length > 0 ? 4 : 0) +
          (left.dateComparison?.differsFromMajority ? 2 : 0) +
          (left.duplicateWeSafeDates.length > 0 ? 1 : 0);
        const rightPriority =
          (right.openFlags.length > 0 ? 4 : 0) +
          (right.dateComparison?.differsFromMajority ? 2 : 0) +
          (right.duplicateWeSafeDates.length > 0 ? 1 : 0);
        return rightPriority - leftPriority || left.employeeId.localeCompare(right.employeeId);
      });

    return success({
      month,
      days,
      datePatternSummary: datePatternAnalysis?.summary ?? null,
      offSiteWork: {
        id: offSiteWork.id,
        referenceNo: offSiteWork.innerRefDocumentId ?? offSiteWork.id,
        startDate: toIsoDate(offSiteWork.startDate),
        endDate: toIsoDate(offSiteWork.endDate),
        objective: offSiteWork.objective,
        location: offSiteWork.location,
        archived: Boolean(offSiteWork.deletedAt),
        participantCount: participantIds.size,
        participantNames: participants.map(
          (participant) => `${participant.firstNameSnapshot} ${participant.lastNameSnapshot}`.trim(),
        ),
      },
      metrics: metrics(participantIds, linkedClaims, offSiteWork.id),
      claims: claimRows,
    });
  },

  async passClaim(
    claimId: string,
    actorId: string,
    month: string,
    expectedRevisionNo: number,
  ): Promise<Result<RecheckMutationResult>> {
    const expectedMonth = parseMonth(month);
    if (!expectedMonth) return error("รูปแบบเดือนต้องเป็น YYYY-MM", "INVALID_MONTH");
    if (!Number.isInteger(expectedRevisionNo) || expectedRevisionNo < 1) {
      return error("revision ที่ส่งมาไม่ถูกต้อง", "INVALID_REVISION");
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return toMutationResult(
          await repo.passClaim(
            claimId,
            actorId,
            expectedMonth,
            expectedRevisionNo,
          ),
        );
      } catch (cause) {
        const code = dbErrorCode(cause);
        if (attempt === 0 && (code === "P2034" || code === "P2002")) continue;
        console.error("[monthly-request-recheck] passClaim failed", cause);
        return error("ไม่สามารถรวบรวมคำขอได้ กรุณาลองใหม่", "COLLECT_FAILED");
      }
    }
    return error("ข้อมูลมีการเปลี่ยนแปลงพร้อมกัน กรุณาลองใหม่", "CONCURRENT_UPDATE");
  },

  async rejectClaim(
    input: RejectClaimInput,
    actorId: string,
  ): Promise<Result<RecheckMutationResult>> {
    const reason = input.reason.trim();
    const expectedMonth = parseMonth(input.month);
    if (!expectedMonth) return error("รูปแบบเดือนต้องเป็น YYYY-MM", "INVALID_MONTH");
    if (reason.length < 3) return error("กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร", "REASON_REQUIRED");
    try {
      const outcome = await repo.rejectClaim(input.claimId, actorId, reason, expectedMonth);
      const result = toMutationResult(outcome);
      if (result.success && outcome.claimantId) {
        await notificationService.send(
          outcome.claimantId,
          "CLAIM_REJECTED",
          "คำขอเบิกถูกตีกลับให้แก้ไข",
          `เหตุผล: ${reason}`,
          "/expense-claim-document",
        );
      }
      return result;
    } catch (cause) {
      console.error("[monthly-request-recheck] rejectClaim failed", cause);
      return error("ไม่สามารถตีกลับคำขอได้", "REJECT_FAILED");
    }
  },

  async flagClaim(
    input: FlagClaimInput,
    actorId: string,
  ): Promise<Result<RecheckMutationResult>> {
    const note = input.note.trim();
    const expectedMonth = parseMonth(input.month);
    if (!expectedMonth) return error("รูปแบบเดือนต้องเป็น YYYY-MM", "INVALID_MONTH");
    if (note.length < 3) return error("กรุณาระบุบันทึกอย่างน้อย 3 ตัวอักษร", "NOTE_REQUIRED");
    try {
      return toMutationResult(await repo.flagClaim(input.claimId, actorId, note, expectedMonth));
    } catch (cause) {
      console.error("[monthly-request-recheck] flagClaim failed", cause);
      return error("ไม่สามารถทำเครื่องหมายได้", "FLAG_FAILED");
    }
  },

  async resolveFlag(
    input: ResolveClaimFlagInput,
    actorId: string,
  ): Promise<Result<RecheckMutationResult>> {
    const note = input.resolutionNote.trim();
    if (!parseMonth(input.month)) return error("รูปแบบเดือนต้องเป็น YYYY-MM", "INVALID_MONTH");
    if (note.length < 3) return error("กรุณาระบุผลการตรวจอย่างน้อย 3 ตัวอักษร", "RESOLUTION_REQUIRED");
    try {
      return toMutationResult(await repo.resolveFlag(input.flagId, actorId, note));
    } catch (cause) {
      console.error("[monthly-request-recheck] resolveFlag failed", cause);
      return error("ไม่สามารถปิดประเด็นได้", "RESOLVE_FAILED");
    }
  },

  async removeFromDraft(
    input: RemoveCollectedClaimInput,
    actorId: string,
  ): Promise<Result<RecheckMutationResult>> {
    const expectedMonth = parseMonth(input.month);
    if (!expectedMonth) return error("รูปแบบเดือนต้องเป็น YYYY-MM", "INVALID_MONTH");
    const reason = input.reason?.trim() || "นำออกเพื่อตรวจสอบใหม่";
    try {
      return toMutationResult(
        await repo.removeFromDraft(input.claimId, actorId, reason, expectedMonth),
      );
    } catch (cause) {
      console.error("[monthly-request-recheck] removeFromDraft failed", cause);
      return error("ไม่สามารถนำคำขอออกจากฉบับร่างได้", "REMOVE_FAILED");
    }
  },
};
