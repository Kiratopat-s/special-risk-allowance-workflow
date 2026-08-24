import { actionLogService } from "@/lib/domains/action-log/service";
import { notificationService } from "@/lib/domains/notification";
import { sendLeaderVerifyEmail } from "@/lib/email";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ActionType, error, success, type Result } from "@/lib/shared/types";
import { leaderVerificationRepository as repo } from "./repository";
import type {
  CreatedLeaderVerification,
  LeaderVerificationPayload,
  LeaderVerificationWithRelations,
  VerifyResult,
} from "./types";
import {
  generateLeaderVerificationToken,
  hashLeaderVerificationPayload,
  hashLeaderVerificationToken,
} from "./token";

const TOKEN_TTL_DAYS = 7;

function expiresAt(): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + TOKEN_TTL_DAYS);
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const leaderVerificationService = {
  async getById(
    verificationId: string,
  ): Promise<Result<LeaderVerificationWithRelations>> {
    const record = await repo.findById(verificationId);
    return record
      ? success(record)
      : error("ไม่พบรายการยืนยัน", "VERIFICATION_NOT_FOUND");
  },

  async createForRevisionInTransaction(
    tx: Prisma.TransactionClient,
    revisionId: string,
  ): Promise<Result<CreatedLeaderVerification[]>> {
    const revision = await repo.findRevisionForVerification(revisionId, tx);
    if (!revision) return error("ไม่พบ revision", "REVISION_NOT_FOUND");
    if (revision.status !== "DRAFT") {
      return error("สร้างการยืนยันได้เฉพาะ revision ฉบับร่าง", "REVISION_NOT_DRAFT");
    }

    const created: CreatedLeaderVerification[] = [];
    for (const osw of revision.offSiteWorks) {
      const dates = revision.workDates.filter(
        (item) => item.revisionOffSiteWorkId === osw.id,
      );
      if (dates.length === 0) continue;
      if ((!osw.leaderUserIdSnapshot && !osw.leaderEmailSnapshot) || !osw.leaderFirstNameSnapshot) {
        return error(
          `ใบนำตัว ${osw.innerRefDocumentIdSnapshot ?? osw.offSiteWorkId} ไม่มีหัวหน้าชุด`,
          "OSW_MISSING_LEADER",
        );
      }

      const payload: LeaderVerificationPayload = {
        version: 1,
        claim: {
          id: revision.expenseClaimId,
          revisionNo: revision.revisionNo,
          expenseMonth: isoDate(revision.expenseClaim.expenseMonth),
          claimant: {
            employeeId: revision.employeeIdSnapshot,
            firstName: revision.firstNameSnapshot,
            lastName: revision.lastNameSnapshot,
            position: revision.positionSnapshot,
            positionShort: revision.positionShortSnapshot,
            positionLevel: revision.positionLevelSnapshot,
            departmentName: revision.departmentNameSnapshot,
            departmentShort: revision.departmentShortSnapshot,
          },
        },
        offSiteWork: {
          id: osw.offSiteWorkId,
          innerRefDocumentId: osw.innerRefDocumentIdSnapshot,
          startDate: isoDate(osw.startDateSnapshot),
          endDate: isoDate(osw.endDateSnapshot),
          objective: osw.objectiveSnapshot,
          location: osw.locationSnapshot,
        },
        rate: Number(revision.ratePerDay),
        dates: dates.map((item) => ({
          date: isoDate(item.workDate),
          dayType: item.dayType,
          holidayType: item.holidayType,
          holidayName: item.holidayName,
          weSafeCodes: item.weSafeCodes.map((code) => code.code),
          dailyRate: Number(item.dailyRate),
        })),
        countDates: dates.length,
        amount: dates.reduce((sum, item) => sum + Number(item.dailyRate), 0),
      };
      const rawToken = generateLeaderVerificationToken();
      const record = await repo.create({
        claimRevisionId: revision.id,
        revisionOffSiteWorkId: osw.id,
        leaderUserId: osw.leaderUserIdSnapshot,
        leaderEmpIdSnapshot: osw.leaderEmpIdSnapshot,
        leaderFirstNameSnapshot: osw.leaderFirstNameSnapshot,
        leaderLastNameSnapshot: osw.leaderLastNameSnapshot,
        leaderPositionSnapshot: osw.leaderPositionSnapshot,
        leaderEmailSnapshot: osw.leaderEmailSnapshot,
        tokenHash: hashLeaderVerificationToken(rawToken),
        expiresAt: expiresAt(),
        payloadSnapshot: payload,
        payloadHash: hashLeaderVerificationPayload(payload),
      }, tx);
      created.push({ record, rawToken });
    }

    return success(created);
  },

  notifyCreated(created: CreatedLeaderVerification[]): void {
    const internalLeaderIds = [
      ...new Set(created.map((item) => item.record.leaderUserId).filter(Boolean)),
    ] as string[];
    if (internalLeaderIds.length > 0) {
      void notificationService.sendToMany(
        internalLeaderIds,
        "LEADER_VERIFY_REQUEST",
        "มีคำขอยืนยันการออกปฏิบัติงาน",
        "กรุณาตรวจสอบวันที่ จำนวนวัน และหลักฐาน We Safe ก่อนลงนามยืนยัน",
        "/dashboard?tab=leader-queue",
      ).catch(() => undefined);
    }
    for (const item of created) {
      if (item.record.leaderEmailSnapshot && !item.record.leaderUserId) {
        void sendLeaderVerifyEmail({
          to: item.record.leaderEmailSnapshot,
          token: item.rawToken,
          offSiteWorkRef: item.record.payloadSnapshot.offSiteWork.innerRefDocumentId,
          claimantName: `${item.record.payloadSnapshot.claim.claimant.firstName} ${item.record.payloadSnapshot.claim.claimant.lastName}`,
          expiresAt: item.record.expiresAt,
        }).catch(() => undefined);
      }
    }
  },

  async getByRawToken(
    rawToken: string,
  ): Promise<Result<LeaderVerificationWithRelations>> {
    if (!rawToken.trim()) return error("Token is required", "INVALID_TOKEN");
    const record = await repo.findByTokenHash(hashLeaderVerificationToken(rawToken));
    if (!record || record.status === "SUPERSEDED" || record.supersededAt) {
      return error("ไม่พบรายการยืนยันหรือลิงก์ถูกยกเลิกแล้ว", "VERIFICATION_NOT_FOUND");
    }
    if (record.expiresAt < new Date()) {
      return error("ลิงก์ยืนยันหมดอายุแล้ว", "TOKEN_EXPIRED");
    }
    return success(record);
  },

  async listForLeader(
    userId: string,
    view: "pending" | "history" | "all" = "all",
  ): Promise<Result<LeaderVerificationWithRelations[]>> {
    return success(await repo.findForLeader(userId, view));
  },

  async listPendingForLeader(
    userId: string,
  ): Promise<Result<LeaderVerificationWithRelations[]>> {
    return this.listForLeader(userId, "pending");
  },

  async verifyByToken(
    rawToken: string,
    signatureData?: Buffer | null,
  ): Promise<Result<VerifyResult>> {
    const lookup = await this.getByRawToken(rawToken);
    if (!lookup.success) return lookup;
    return confirmRecord(lookup.data, signatureData);
  },

  async verifyAsInternalLeader(
    revisionId: string,
    revisionOffSiteWorkId: string,
    userId: string,
    signatureData?: Buffer | null,
  ): Promise<Result<VerifyResult>> {
    const record = await repo.findByRevisionAndOsw(revisionId, revisionOffSiteWorkId);
    if (!record) return error("ไม่พบรายการยืนยัน", "VERIFICATION_NOT_FOUND");
    if (record.leaderUserId !== userId) {
      return error("คุณไม่ใช่หัวหน้าชุดของรายการนี้", "NOT_LEADER");
    }
    return confirmRecord(record, signatureData);
  },

  async refreshToken(
    verificationId: string,
    actorId: string,
    canManage: boolean,
  ): Promise<Result<void>> {
    const record = await repo.findById(verificationId);
    if (!record) return error("ไม่พบรายการยืนยัน", "VERIFICATION_NOT_FOUND");
    const isClaimant = record.expenseClaim.userId === actorId;
    if (!isClaimant && !canManage) return error("ไม่มีสิทธิ์ต่ออายุลิงก์", "FORBIDDEN");
    if (record.status !== "PENDING" || record.confirmedAt || record.supersededAt) {
      return error("รายการนี้ไม่อยู่ในสถานะที่ต่ออายุได้", "VERIFICATION_NOT_PENDING");
    }
    if (record.leaderUserId || !record.leaderEmailSnapshot) {
      return error("รายการหัวหน้าภายในไม่ต้องใช้ลิงก์อีเมล", "INTERNAL_LEADER");
    }
    const rawToken = generateLeaderVerificationToken();
    const nextExpiry = expiresAt();
    await repo.rotateToken(
      verificationId,
      hashLeaderVerificationToken(rawToken),
      nextExpiry,
    );
    void sendLeaderVerifyEmail({
      to: record.leaderEmailSnapshot,
      token: rawToken,
      offSiteWorkRef: record.payloadSnapshot.offSiteWork.innerRefDocumentId,
      claimantName: `${record.payloadSnapshot.claim.claimant.firstName} ${record.payloadSnapshot.claim.claimant.lastName}`,
      expiresAt: nextExpiry,
    }).catch(() => undefined);
    return success(undefined, "ส่งลิงก์ใหม่ให้หัวหน้าชุดแล้ว");
  },
};

async function confirmRecord(
  record: LeaderVerificationWithRelations,
  signatureData?: Buffer | null,
): Promise<Result<VerifyResult>> {
  if (!signatureData || signatureData.length === 0) {
    return error("กรุณาลงลายเซ็นก่อนยืนยัน", "SIGNATURE_REQUIRED");
  }
  const confirmation = await repo.confirmCurrent(record.id, signatureData);
  if (confirmation.outcome === "NOT_FOUND") {
    return error("ไม่พบรายการยืนยัน", "VERIFICATION_NOT_FOUND");
  }
  if (confirmation.outcome === "EXPIRED") {
    return error("ลิงก์ยืนยันหมดอายุแล้ว", "TOKEN_EXPIRED");
  }
  if (confirmation.outcome === "NOT_CURRENT") {
    return error(
      "รายการยืนยันนี้ไม่ใช่ revision ปัจจุบันหรือสถานะคำขอเปลี่ยนแล้ว",
      "VERIFICATION_CONFLICT",
    );
  }
  const { allDone } = confirmation;

  // External leaders have no authenticated User actor; the immutable signed
  // LeaderVerification row is their audit record. Never impersonate claimant.
  if (record.leaderUserId) {
    await actionLogService.log({
      userId: record.leaderUserId,
      actionType: ActionType.LEADER_VERIFICATION_CONFIRMED,
      actionDescription: `Leader verification "${record.id}" confirmed`,
      targetEntityType: "LeaderVerification",
      targetEntityId: record.id,
      newData: {
        claimId: record.expenseClaimId,
        revisionNo: record.revisionNo,
        offSiteWorkId: record.offSiteWorkId,
        payloadHash: record.payloadHash,
      } as Prisma.JsonObject,
    });
  }

  void notificationService.send(
    record.expenseClaim.userId,
    "CLAIM_STATUS_CHANGED",
    allDone ? "หัวหน้าชุดยืนยันครบแล้ว" : "หัวหน้าชุดยืนยันแล้ว 1 รายการ",
    allDone
      ? "คำขอของคุณพร้อมให้ผู้รวบรวมตรวจสอบ"
      : "คำขอยังรอหัวหน้าชุดรายการอื่นยืนยัน",
    `/dashboard?tab=expense-claims&claimId=${record.expenseClaimId}`,
  ).catch(() => undefined);
  return success({
    verified: true,
    allDone,
    expenseClaimId: confirmation.expenseClaimId,
  });
}
