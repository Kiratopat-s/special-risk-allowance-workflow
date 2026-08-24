import { actionLogService } from "@/lib/domains/action-log/service";
import { ActionType, error, success, type PaginatedResult, type Result } from "@/lib/shared/types";
import { offSiteWorkRepository as repo } from "./repository";
import type {
  CreateOffSiteWorkInput,
  OffSiteWorkEntity,
  OffSiteWorkFilterCriteria,
  OffSiteWorkWithRelations,
  ResolvedParticipant,
  UpdateOffSiteWorkInput,
} from "./types";

function snapshotEmployeeId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return /^[0-9]{1,6}$/.test(trimmed) ? trimmed.padStart(6, "0") : null;
}

function participantIds(
  input: { participantUserIds?: string[] },
): string[] {
  return [
    ...new Set(
      (input.participantUserIds ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

async function resolveParticipants(ids: string[]): Promise<Result<ResolvedParticipant[]>> {
  const users = await repo.findUsersByIds(ids);
  if (users.length !== ids.length) {
    return error("พบผู้เดินทางที่ไม่มีอยู่หรือไม่ได้ใช้งาน", "INVALID_PARTICIPANTS");
  }
  return success(
    users.map((user) => ({
      userId: user.id,
      employeeIdSnapshot: snapshotEmployeeId(user.employeeId),
      firstNameSnapshot: user.firstName,
      lastNameSnapshot: user.lastName,
      positionSnapshot: user.position,
      positionShortSnapshot: user.positionShort,
      positionLevelSnapshot: user.positionLevel,
      departmentIdSnapshot: user.departmentId,
      departmentNameSnapshot: user.department?.name ?? null,
    })),
  );
}

async function resolveLeader<T extends CreateOffSiteWorkInput | UpdateOffSiteWorkInput>(
  input: T,
): Promise<Result<T>> {
  if (!input.leaderUserId) {
    if (
      input.leaderEmpId?.trim() &&
      snapshotEmployeeId(input.leaderEmpId) === null
    ) {
      return error(
        "รหัสพนักงานหัวหน้าชุดต้องเป็นตัวเลข 1-6 หลัก",
        "INVALID_LEADER_EMPLOYEE_ID",
      );
    }
    const hasExternalLeader = Boolean(
      input.leaderFirstName?.trim() ||
        input.leaderLastName?.trim() ||
        input.leaderEmail?.trim(),
    );
    if (input.leaderUserId === null && !hasExternalLeader) {
      return success({
        ...input,
        leaderEmpId: null,
        leaderFirstName: null,
        leaderLastName: null,
        leaderPosition: null,
        leaderEmail: null,
      });
    }
    return success({
      ...input,
      leaderEmpId: snapshotEmployeeId(input.leaderEmpId),
    });
  }
  const [leader] = await repo.findUsersByIds([input.leaderUserId]);
  if (!leader) return error("ไม่พบหัวหน้าชุดที่เลือก", "LEADER_NOT_FOUND");
  return success({
    ...input,
    leaderEmpId: snapshotEmployeeId(leader.employeeId),
    leaderFirstName: leader.firstName,
    leaderLastName: leader.lastName,
    leaderPosition: leader.position,
    leaderEmail: leader.peaEmail ?? leader.email,
  });
}

function validDateRange(startValue: Date | string, endValue: Date | string): boolean {
  const start = new Date(startValue);
  const end = new Date(endValue);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
}

export const offSiteWorkService = {
  async getById(id: string): Promise<Result<OffSiteWorkWithRelations>> {
    const record = await repo.findWithRelations(id);
    return record
      ? success(record)
      : error("ไม่พบใบนำตัว", "OFF_SITE_WORK_NOT_FOUND");
  },

  async create(
    input: CreateOffSiteWorkInput,
    actorId: string,
  ): Promise<Result<OffSiteWorkEntity>> {
    if (!input.id?.trim()) return error("กรุณาระบุเลขที่ใบนำตัว", "MISSING_ID");
    if (!validDateRange(input.startDate, input.endDate)) {
      return error("ช่วงวันที่ใบนำตัวไม่ถูกต้อง", "INVALID_DATE_RANGE");
    }
    if (input.supersedesId) {
      const target = await repo.findAnyById(input.supersedesId);
      if (!target || target.deletedAt || !target.lockedAt) {
        return error(
          "สร้างฉบับทดแทนได้เฉพาะใบนำตัวที่ถูกล็อกและยังไม่ถูกลบ",
          "INVALID_REPLACEMENT_TARGET",
        );
      }
    }

    const ids = participantIds(input);
    if (ids.length === 0) {
      return error("กรุณาเลือกผู้เดินทางอย่างน้อย 1 คน", "PARTICIPANTS_REQUIRED");
    }
    const participants = await resolveParticipants(ids);
    if (!participants.success) return participants;
    const leaderInput = await resolveLeader(input);
    if (!leaderInput.success) return leaderInput;

    let creation: {
      record: OffSiteWorkEntity;
      invalidatedClaimIds: string[];
    };
    try {
      creation = await repo.create(leaderInput.data, actorId, participants.data);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      const prismaCode =
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : "";
      if (code === "DUPLICATE_OFF_SITE_WORK_ID") {
        return error("เลขที่ใบนำตัวนี้มีอยู่แล้ว", "DUPLICATE_ID");
      }
      if (code === "INVALID_REPLACEMENT_TARGET") {
        return error("ใบนำตัวต้นฉบับไม่อยู่ในสถานะที่แทนที่ได้", code);
      }
      if (code === "REPLACEMENT_ALREADY_EXISTS") {
        return error("ใบนำตัวต้นฉบับมีฉบับทดแทนที่ใช้งานอยู่แล้ว", code);
      }
      if (code === "CLAIM_COLLECTION_STATE_CHANGED" || prismaCode === "P2034") {
        return error(
          "ข้อมูลคำขอหรือ monthly request เปลี่ยนระหว่างสร้างฉบับทดแทน กรุณาลองใหม่",
          "CONCURRENT_WORKFLOW_CHANGE",
        );
      }
      if (prismaCode === "P2002") {
        return input.supersedesId
          ? error(
              "ใบนำตัวต้นฉบับมีฉบับทดแทนที่ใช้งานอยู่แล้ว",
              "REPLACEMENT_ALREADY_EXISTS",
            )
          : error("เลขที่ใบนำตัวนี้มีอยู่แล้ว", "DUPLICATE_ID");
      }
      throw cause;
    }
    const { record, invalidatedClaimIds } = creation;
    await actionLogService.log({
      userId: actorId,
      actionType: ActionType.OTHER,
      actionDescription: `Off-site work "${record.id}" created`,
      targetEntityType: "OffSiteWork",
      targetEntityId: record.id,
      newData: {
        participantCount: participants.data.length,
        startDate: record.startDate.toISOString(),
        endDate: record.endDate.toISOString(),
      },
    });
    await Promise.all(
      invalidatedClaimIds.map((claimId) =>
        actionLogService.log({
          userId: actorId,
          actionType: ActionType.CLAIM_REJECTED,
          actionDescription: `Expense claim "${claimId}" invalidated by replacement off-site work "${record.id}"`,
          targetEntityType: "ExpenseClaim",
          targetEntityId: claimId,
          newData: {
            replacementOffSiteWorkId: record.id,
            supersededOffSiteWorkId: record.supersedesId,
          },
        }),
      ),
    );
    return success(record, "สร้างใบนำตัวเรียบร้อย");
  },

  async update(
    id: string,
    input: UpdateOffSiteWorkInput,
    actorId: string,
  ): Promise<Result<OffSiteWorkEntity>> {
    const existing = await repo.findById(id);
    if (!existing) return error("ไม่พบใบนำตัว", "OFF_SITE_WORK_NOT_FOUND");
    if (existing.lockedAt) {
      return error(
        "ใบนำตัวถูกล็อกหลังมีการส่งคำขอแล้ว กรุณาสร้างใบนำตัวฉบับทดแทน",
        "OFF_SITE_WORK_LOCKED",
      );
    }
    if (
      !validDateRange(
        input.startDate ?? existing.startDate,
        input.endDate ?? existing.endDate,
      )
    ) {
      return error("ช่วงวันที่ใบนำตัวไม่ถูกต้อง", "INVALID_DATE_RANGE");
    }

    let participants: ResolvedParticipant[] | undefined;
    if (input.participantUserIds !== undefined) {
      const ids = participantIds(input);
      if (ids.length === 0) {
        return error("กรุณาเลือกผู้เดินทางอย่างน้อย 1 คน", "PARTICIPANTS_REQUIRED");
      }
      const result = await resolveParticipants(ids);
      if (!result.success) return result;
      participants = result.data;
    }
    const leaderInput = await resolveLeader(input);
    if (!leaderInput.success) return leaderInput;

    let record: OffSiteWorkEntity;
    try {
      record = await repo.update(id, leaderInput.data, participants);
    } catch (cause) {
      if (cause instanceof Error && cause.message === "OFF_SITE_WORK_LOCKED") {
        return error(
          "ใบนำตัวถูกล็อกระหว่างการแก้ไข กรุณาสร้างฉบับทดแทน",
          "OFF_SITE_WORK_LOCKED",
        );
      }
      throw cause;
    }
    await actionLogService.log({
      userId: actorId,
      actionType: ActionType.OTHER,
      actionDescription: `Off-site work "${id}" updated`,
      targetEntityType: "OffSiteWork",
      targetEntityId: id,
      newData: {
        changedFields: Object.keys(input),
        participantCount: record.participants.length,
        lockedAt: record.lockedAt?.toISOString() ?? null,
      },
    });
    return success(record, "แก้ไขใบนำตัวเรียบร้อย");
  },

  async delete(id: string, actorId: string): Promise<Result<void>> {
    const existing = await repo.findById(id);
    if (!existing) return error("ไม่พบใบนำตัว", "OFF_SITE_WORK_NOT_FOUND");
    if (existing.lockedAt || (await repo.hasRevisionSnapshots(id))) {
      return error("ไม่สามารถลบใบนำตัวที่ถูกใช้อ้างอิงแล้ว", "OFF_SITE_WORK_LOCKED");
    }
    try {
      await repo.softDelete(id);
    } catch (cause) {
      if (cause instanceof Error && cause.message === "OFF_SITE_WORK_LOCKED") {
        return error("ใบนำตัวถูกใช้อ้างอิงแล้ว", "OFF_SITE_WORK_LOCKED");
      }
      throw cause;
    }
    await actionLogService.log({
      userId: actorId,
      actionType: ActionType.OTHER,
      actionDescription: `Off-site work "${id}" deleted`,
      targetEntityType: "OffSiteWork",
      targetEntityId: id,
    });
    return success(undefined, "ยกเลิกใบนำตัวเรียบร้อย");
  },

  async list(
    criteria: OffSiteWorkFilterCriteria,
  ): Promise<Result<PaginatedResult<OffSiteWorkWithRelations>>> {
    return success(await repo.findMany(criteria));
  },
};
