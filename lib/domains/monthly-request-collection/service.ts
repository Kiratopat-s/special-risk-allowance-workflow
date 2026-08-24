/** Paper-first Monthly Request Collection business service. */

import { ActionType, type Prisma } from "@/lib/generated/prisma/client";
import { actionLogService } from "@/lib/domains/action-log/service";
import { notificationService } from "@/lib/domains/notification";
import {
  error,
  success,
  type PaginatedResult,
  type Result,
} from "@/lib/shared/types";
import {
  MrcInvariantError,
  monthlyRequestCollectionRepository as repo,
} from "./repository";
import type {
  CompleteMrcInput,
  CreateMrcInput,
  CreateMrcReplacementInput,
  EligibleExpenseClaimForCollection,
  MrcDepartmentOption,
  MrcExportAuditMetadata,
  MrcFilterCriteria,
  MonthlyRequestCollectionEntity,
  MonthlyRequestCollectionWithRelations,
  UpdateMrcInput,
  VoidMrcResult,
} from "./types";

type JsonValue = Prisma.JsonValue;

function handleFailure(cause: unknown): ReturnType<typeof error> {
  if (cause instanceof MrcInvariantError) {
    return error(cause.message, cause.code);
  }
  console.error("Monthly request collection operation failed", cause);
  return error("Unable to process monthly request collection", "MRC_OPERATION_FAILED");
}

async function notifyParticipants(
  mrcId: string,
  actorId: string,
  type: "MRC_FINALIZED" | "MRC_ALL_DONE" | "MRC_CANCELLED" | "MRC_VOIDED",
  title: string,
  body: string,
): Promise<void> {
  const mrc = await repo.findById(mrcId);
  if (!mrc) return;
  const claimantIds = await repo.findClaimantUserIds(mrcId);
  await notificationService.sendToMany(
    [...new Set([mrc.collectorId, actorId, ...claimantIds])],
    type,
    title,
    body,
    "/dashboard?tab=monthly-requests",
  );
}

function dispatchParticipantNotification(
  ...args: Parameters<typeof notifyParticipants>
): void {
  void notifyParticipants(...args).catch((cause) => {
    console.error("Failed to notify monthly request participants", cause);
  });
}

async function audit(
  actorId: string,
  actionType: ActionType,
  id: string,
  description: string,
  previousData?: JsonValue,
  newData?: JsonValue,
): Promise<void> {
  await actionLogService.log({
    userId: actorId,
    actionType,
    actionDescription: description,
    targetEntityType: "MonthlyRequestCollection",
    targetEntityId: id,
    previousData,
    newData,
  });
}

export const monthlyRequestCollectionService = {
  async getById(
    id: string,
  ): Promise<Result<MonthlyRequestCollectionWithRelations>> {
    const mrc = await repo.findWithRelations(id);
    return mrc
      ? success(mrc)
      : error("Monthly request collection not found", "MRC_NOT_FOUND");
  },

  async list(
    criteria: MrcFilterCriteria,
  ): Promise<Result<PaginatedResult<MonthlyRequestCollectionWithRelations>>> {
    try {
      return success(await repo.findMany(criteria));
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async listDepartments(): Promise<Result<MrcDepartmentOption[]>> {
    return success(await repo.listDepartments());
  },

  async listEligibleExpenseClaims(
    month: Date | string,
    departmentId: string,
    existingMrcId?: string,
  ): Promise<Result<EligibleExpenseClaimForCollection[]>> {
    try {
      return success(
        await repo.findEligibleExpenseClaimsForMonth(
          month,
          departmentId,
          existingMrcId,
        ),
      );
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async create(
    data: CreateMrcInput,
    actorId: string,
  ): Promise<Result<MonthlyRequestCollectionEntity>> {
    try {
      const mrc = await repo.createDraft(data, actorId);
      await audit(
        actorId,
        ActionType.OTHER,
        mrc.id,
        `Monthly request draft "${mrc.id}" created`,
        undefined,
        {
          status: mrc.status,
          departmentId: mrc.departmentId,
          collectForMonth: mrc.collectForMonth.toISOString(),
          claimCount: mrc.claimCount,
        },
      );
      return success(mrc, "Monthly request draft created");
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async update(
    id: string,
    data: UpdateMrcInput,
    actorId: string,
  ): Promise<Result<MonthlyRequestCollectionEntity>> {
    try {
      const mrc = await repo.updateDraftItems(id, data.expenseClaimIds, actorId);
      await audit(
        actorId,
        ActionType.OTHER,
        id,
        `Monthly request draft "${id}" updated`,
        undefined,
        { claimCount: mrc.claimCount },
      );
      return success(mrc, "Monthly request draft updated");
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async finalize(
    id: string,
    actorId: string,
  ): Promise<Result<MonthlyRequestCollectionEntity>> {
    try {
      const before = await repo.findById(id);
      const mrc = await repo.finalizeDraft(id, actorId);
      if (before?.status !== "FINALIZED") {
        await audit(
          actorId,
          ActionType.MRC_FINALIZED,
          id,
          `Monthly request "${id}" finalized for paper approval`,
          { status: before?.status ?? null },
          {
            status: mrc.status,
            batchNo: mrc.batchNo,
            snapshotHash: mrc.snapshotHash,
          },
        );
        dispatchParticipantNotification(
          id,
          actorId,
          "MRC_FINALIZED",
          "สรุปคำขอรายเดือนพร้อมพิมพ์แล้ว",
          "Collector สรุปข้อมูลแล้ว เอกสารพร้อมพิมพ์เพื่อลงนามบนกระดาษ",
        );
      }
      return success(mrc, "Monthly request finalized");
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async complete(
    id: string,
    input: CompleteMrcInput,
    actorId: string,
  ): Promise<Result<MonthlyRequestCollectionEntity>> {
    try {
      const before = await repo.findById(id);
      const mrc = await repo.complete(id, input, actorId);
      if (before?.status !== "ALL_DONE") {
        await audit(
          actorId,
          ActionType.MRC_ALL_DONE_RECORDED,
          id,
          `Paper approval recorded for monthly request "${id}"`,
          { status: before?.status ?? null },
          {
            status: mrc.status,
            paperApprovedAt: mrc.paperApprovedAt?.toISOString() ?? null,
            note: mrc.allDoneNote,
          },
        );
        dispatchParticipantNotification(
          id,
          actorId,
          "MRC_ALL_DONE",
          "บันทึกผลอนุมัติเอกสารแล้ว",
          "Collector บันทึกว่า อก.ฝช. ยืนยันเอกสารกระดาษเรียบร้อยแล้ว",
        );
      }
      return success(mrc, "Paper approval recorded");
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async cancel(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<Result<MonthlyRequestCollectionEntity>> {
    if (!reason.trim()) return error("Cancel reason is required", "REASON_REQUIRED");
    try {
      const before = await repo.findById(id);
      const mrc = await repo.cancelDraft(id, reason.trim(), actorId);
      if (before?.status !== "CANCELLED") {
        await audit(
          actorId,
          ActionType.MRC_DRAFT_CANCELLED,
          id,
          `Monthly request draft "${id}" cancelled`,
          { status: before?.status ?? null },
          { status: mrc.status, reason: mrc.cancelReason },
        );
        dispatchParticipantNotification(
          id,
          actorId,
          "MRC_CANCELLED",
          "ยกเลิกร่างสรุปคำขอรายเดือนแล้ว",
          reason.trim(),
        );
      }
      return success(mrc, "Monthly request draft cancelled");
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async void(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<Result<VoidMrcResult>> {
    if (!reason.trim()) return error("Void reason is required", "REASON_REQUIRED");
    try {
      const before = await repo.findById(id);
      const result = await repo.voidFinalized(id, reason.trim(), actorId);
      if (before?.status !== "VOIDED") {
        await audit(
          actorId,
          ActionType.MRC_VOIDED,
          id,
          `Finalized monthly request "${id}" voided`,
          { status: before?.status ?? null },
          {
            status: result.voided.status,
            reason: result.voided.voidReason,
            replacementDraftId: result.replacementDraft.id,
          },
        );
        dispatchParticipantNotification(
          id,
          actorId,
          "MRC_VOIDED",
          "ยกเลิกเอกสารสรุปคำขอรายเดือนแล้ว",
          reason.trim(),
        );
      }
      return success(
        result,
        "Monthly request voided and replacement draft prepared",
      );
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async createReplacement(
    input: CreateMrcReplacementInput,
    actorId: string,
  ): Promise<Result<MonthlyRequestCollectionEntity>> {
    try {
      const mrc = await repo.createReplacementDraft(input.voidedMrcIds, actorId);
      await audit(
        actorId,
        ActionType.OTHER,
        mrc.id,
        `Replacement monthly request draft "${mrc.id}" created`,
        undefined,
        { voidedMrcIds: input.voidedMrcIds },
      );
      return success(mrc, "Replacement draft created");
    } catch (cause) {
      return handleFailure(cause);
    }
  },

  async recordPrintRendered(
    id: string,
    actorId: string,
  ): Promise<Result<void>> {
    const mrc = await repo.findById(id);
    if (!mrc) return error("Monthly request collection not found", "MRC_NOT_FOUND");
    if (mrc.status === "CANCELLED") {
      return error("A cancelled draft cannot be printed", "MRC_NOT_PRINTABLE");
    }
    const preview = mrc.status === "DRAFT";
    await audit(
      actorId,
      preview ? ActionType.MRC_PREVIEW_RENDERED : ActionType.MRC_OFFICIAL_RENDERED,
      id,
      preview
        ? `Monthly request draft preview "${id}" rendered`
        : `Monthly request official document "${id}" rendered`,
      undefined,
      { status: mrc.status, snapshotHash: mrc.snapshotHash },
    );
    return success(undefined);
  },

  async recordExported(
    id: string,
    actorId: string,
    metadata: MrcExportAuditMetadata,
  ): Promise<Result<void>> {
    const mrc = await repo.findById(id);
    if (!mrc) return error("Monthly request collection not found", "MRC_NOT_FOUND");
    if (mrc.status !== "FINALIZED" && mrc.status !== "ALL_DONE") {
      return error(
        "Only finalized monthly requests can be exported",
        "MRC_NOT_EXPORTABLE",
      );
    }
    await audit(
      actorId,
      ActionType.DATA_EXPORTED,
      id,
      `Monthly request workbook "${id}" exported`,
      undefined,
      {
        status: mrc.status,
        collectForMonth: mrc.collectForMonth.toISOString().slice(0, 7),
        batchNo: mrc.batchNo,
        filename: metadata.filename,
        dataRowCount: metadata.dataRowCount,
        datesRowCount: metadata.datesRowCount,
        snapshotHash: mrc.snapshotHash,
      },
    );
    return success(undefined);
  },
};
