import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { createMonthlyRequestItemDates } from "@/lib/domains/monthly-request-collection/item-date-persistence";

const ACTIVE_MRC_STATUSES = ["DRAFT", "FINALIZED", "ALL_DONE"] as const;

export interface RepositoryMutationOutcome {
  ok: boolean;
  code?: string;
  message?: string;
  claimId?: string;
  claimantId?: string;
  monthlyRequestId?: string;
  batchNo?: number | null;
}

function sameUtcMonth(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  );
}

async function recalculateDraft(
  tx: Prisma.TransactionClient,
  monthlyRequestId: string,
): Promise<void> {
  const items = await tx.monthlyRequestCollectionItem.findMany({
    where: { monthlyRequestCollectionId: monthlyRequestId, removedAt: null },
    select: { dayCountSnapshot: true, amountSnapshot: true },
  });

  const countDates = items.reduce((sum, item) => sum + (item.dayCountSnapshot ?? 0), 0);
  const amount = items.reduce(
    (sum, item) => sum.add(item.amountSnapshot ?? 0),
    new Prisma.Decimal(0),
  );

  await tx.monthlyRequestCollection.update({
    where: { id: monthlyRequestId },
    data: { claimCount: items.length, countDates, amount },
  });
}

export const monthlyRequestRecheckRepository = {
  listDepartments() {
    return prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true },
      orderBy: [{ name: "asc" }],
    });
  },

  findOverlappingOffSiteWorks(monthStart: Date, nextMonth: Date) {
    return prisma.offSiteWork.findMany({
      where: {
        OR: [
          {
            startDate: { lt: nextMonth },
            endDate: { gte: monthStart },
          },
          {
            deletedAt: { not: null },
            revisionSnapshots: {
              some: {
                revision: {
                  expenseClaim: {
                    expenseMonth: { gte: monthStart, lt: nextMonth },
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        innerRefDocumentId: true,
        startDate: true,
        endDate: true,
        objective: true,
        location: true,
        deletedAt: true,
        participants: {
          select: {
            userId: true,
            firstNameSnapshot: true,
            lastNameSnapshot: true,
            departmentIdSnapshot: true,
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { innerRefDocumentId: "asc" }, { id: "asc" }],
    });
  },

  findClaimsForMonth(monthStart: Date, nextMonth: Date) {
    return prisma.expenseClaim.findMany({
      where: { expenseMonth: { gte: monthStart, lt: nextMonth } },
      select: {
        id: true,
        expenseMonth: true,
        userId: true,
        status: true,
        currentRevisionNo: true,
        rejectionReason: true,
        cancelledAt: true,
        revisions: {
          select: {
            id: true,
            revisionNo: true,
            employeeIdSnapshot: true,
            firstNameSnapshot: true,
            lastNameSnapshot: true,
            positionShortSnapshot: true,
            positionLevelSnapshot: true,
            departmentIdSnapshot: true,
            departmentNameSnapshot: true,
            totalDays: true,
            totalAmount: true,
            remark: true,
            offSiteWorks: {
              select: {
                id: true,
                offSiteWorkId: true,
                innerRefDocumentIdSnapshot: true,
                leaderVerification: { select: { status: true } },
              },
            },
            workDates: {
              select: {
                workDate: true,
                dayType: true,
                holidayType: true,
                holidayName: true,
                requiresWeSafe: true,
                revisionOffSiteWork: {
                  select: {
                    offSiteWorkId: true,
                    innerRefDocumentIdSnapshot: true,
                  },
                },
                weSafeCodes: { select: { code: true }, orderBy: { createdAt: "asc" } },
              },
              orderBy: { workDate: "asc" },
            },
          },
          orderBy: { revisionNo: "desc" },
        },
        reviewFlags: {
          select: {
            id: true,
            status: true,
            note: true,
            openedAt: true,
            resolutionNote: true,
            resolvedAt: true,
            openedBy: { select: { firstName: true, lastName: true } },
            resolvedBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { openedAt: "desc" },
        },
        monthlyRequestItems: {
          where: {
            removedAt: null,
            monthlyRequestCollection: { status: { in: [...ACTIVE_MRC_STATUSES] } },
          },
          select: {
            claimRevisionId: true,
            monthlyRequestCollection: {
              select: {
                id: true,
                departmentId: true,
                collectForMonth: true,
                batchNo: true,
                status: true,
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });
  },

  async passClaim(
    claimId: string,
    actorId: string,
    expectedMonth: Date,
    expectedRevisionNo: number,
  ): Promise<RepositoryMutationOutcome> {
    return prisma.$transaction(
      async (tx) => {
        const claim = await tx.expenseClaim.findUnique({
          where: { id: claimId },
          include: {
            revisions: {
              include: {
                offSiteWorks: { include: { leaderVerification: true } },
                workDates: {
                  include: {
                    revisionOffSiteWork: true,
                    weSafeCodes: true,
                  },
                  orderBy: { workDate: "asc" },
                },
              },
            },
            reviewFlags: { where: { status: "OPEN" }, select: { id: true } },
            monthlyRequestItems: {
              where: {
                removedAt: null,
                monthlyRequestCollection: { status: { in: [...ACTIVE_MRC_STATUSES] } },
              },
              select: {
                claimRevisionId: true,
                monthlyRequestCollectionId: true,
                monthlyRequestCollection: {
                  select: {
                    id: true,
                    departmentId: true,
                    collectForMonth: true,
                    batchNo: true,
                    status: true,
                  },
                },
              },
            },
          },
        });

        if (!claim) return { ok: false, code: "CLAIM_NOT_FOUND", message: "ไม่พบคำขอเบิก" };
        if (!sameUtcMonth(claim.expenseMonth, expectedMonth)) {
          return { ok: false, code: "MONTH_MISMATCH", message: "เดือนของคำขอเบิกไม่ตรงกับเดือนที่กำลังตรวจ" };
        }
        const revision = claim.revisions.find(
          (item) => item.revisionNo === claim.currentRevisionNo,
        );
        if (!revision) {
          return { ok: false, code: "CURRENT_REVISION_NOT_FOUND", message: "ไม่พบ revision ปัจจุบันของคำขอ" };
        }
        if (claim.currentRevisionNo !== expectedRevisionNo) {
          return {
            ok: false,
            code: "REVISION_CONFLICT",
            message: "คำขอมี revision ใหม่แล้ว กรุณาโหลดข้อมูลล่าสุดก่อนรวบรวม",
          };
        }

        const existingDraftItem = claim.monthlyRequestItems.find(
          (item) =>
            item.claimRevisionId === revision.id &&
            item.monthlyRequestCollection.status === "DRAFT" &&
            item.monthlyRequestCollection.departmentId === revision.departmentIdSnapshot &&
            sameUtcMonth(item.monthlyRequestCollection.collectForMonth, expectedMonth),
        );
        if (existingDraftItem) {
          return {
            ok: true,
            claimId: claim.id,
            monthlyRequestId: existingDraftItem.monthlyRequestCollection.id,
            batchNo: existingDraftItem.monthlyRequestCollection.batchNo,
          };
        }
        if (claim.monthlyRequestItems.length > 0) {
          return { ok: false, code: "ALREADY_COLLECTED", message: "คำขอนี้ถูกรวบรวมแล้ว" };
        }
        if (claim.status !== "READY_FOR_COLLECTION") {
          return { ok: false, code: "CLAIM_NOT_READY", message: "คำขอเบิกยังไม่พร้อมรวบรวม" };
        }
        if (claim.reviewFlags.length > 0) {
          return { ok: false, code: "OPEN_SUSPICIOUS_FLAG", message: "ต้องปิดประเด็นน่าสงสัยก่อนรวบรวมคำขอ" };
        }
        if (revision.offSiteWorks.length === 0) {
          return { ok: false, code: "NO_OFF_SITE_WORK", message: "คำขอไม่มีใบนำตัวที่อ้างอิง" };
        }
        if (
          revision.offSiteWorks.some(
            (item) => item.leaderVerification?.status !== "CONFIRMED",
          )
        ) {
          return { ok: false, code: "LEADER_NOT_CONFIRMED", message: "หัวหน้าชุดยังยืนยันไม่ครบทุกใบนำตัว" };
        }

        let draft = await tx.monthlyRequestCollection.findFirst({
          where: {
            departmentId: revision.departmentIdSnapshot,
            collectForMonth: expectedMonth,
            status: "DRAFT",
          },
          orderBy: [{ batchNo: "asc" }, { createdAt: "asc" }],
        });

        if (!draft) {
          draft = await tx.monthlyRequestCollection.create({
            data: {
              departmentId: revision.departmentIdSnapshot,
              collectorId: actorId,
              collectForMonth: expectedMonth,
              batchNo: null,
              status: "DRAFT",
            },
          });
        }

        const maxRow = await tx.monthlyRequestCollectionItem.aggregate({
          where: { monthlyRequestCollectionId: draft.id, removedAt: null },
          _max: { rowNo: true },
        });

        const monthlyRequestItem = await tx.monthlyRequestCollectionItem.create({
          data: {
            monthlyRequestCollectionId: draft.id,
            expenseClaimId: claim.id,
            claimRevisionId: revision.id,
            addedById: actorId,
            rowNo: (maxRow._max.rowNo ?? 0) + 1,
            employeeIdSnapshot: revision.employeeIdSnapshot,
            firstNameSnapshot: revision.firstNameSnapshot,
            lastNameSnapshot: revision.lastNameSnapshot,
            positionShortSnapshot: revision.positionShortSnapshot,
            positionLevelSnapshot: revision.positionLevelSnapshot,
            departmentIdSnapshot: revision.departmentIdSnapshot,
            departmentNameSnapshot: revision.departmentNameSnapshot,
            departmentShortSnapshot: revision.departmentShortSnapshot,
            dayCountSnapshot: revision.totalDays,
            amountSnapshot: revision.totalAmount,
            remarkSnapshot: revision.remark,
          },
        });
        await createMonthlyRequestItemDates(
          tx,
          monthlyRequestItem.id,
          revision.workDates.map((date) => ({
            workDate: date.workDate,
            offSiteWorkIdSnapshot: date.revisionOffSiteWork.offSiteWorkId,
            offSiteWorkRefSnapshot:
              date.revisionOffSiteWork.innerRefDocumentIdSnapshot,
            dayType: date.dayType,
            holidayType: date.holidayType,
            holidayName: date.holidayName,
            dailyRate: date.dailyRate,
            weSafeCodes: date.weSafeCodes.map((item) => item.code),
          })),
        );

        await tx.expenseClaim.update({
          where: { id: claim.id },
          data: { status: "COLLECTED", collectedAt: new Date() },
        });
        await recalculateDraft(tx, draft.id);
        await tx.userActionLog.create({
          data: {
            userId: actorId,
            actionType: "CLAIM_COLLECTED",
            actionDescription: `Collected expense claim "${claim.id}" into monthly request "${draft.id}"`,
            targetEntityType: "ExpenseClaim",
            targetEntityId: claim.id,
            targetDepartmentId: revision.departmentIdSnapshot,
            newData: {
              status: "COLLECTED",
              monthlyRequestId: draft.id,
              batchNo: draft.batchNo,
              revisionNo: revision.revisionNo,
            },
          },
        });

        return {
          ok: true,
          claimId: claim.id,
          monthlyRequestId: draft.id,
          batchNo: draft.batchNo,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async rejectClaim(
    claimId: string,
    actorId: string,
    reason: string,
    expectedMonth: Date,
  ): Promise<RepositoryMutationOutcome> {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.findUnique({
        where: { id: claimId },
        include: {
          revisions: { select: { id: true, revisionNo: true } },
          monthlyRequestItems: {
            where: { removedAt: null },
            include: { monthlyRequestCollection: true },
          },
        },
      });
      if (!claim) return { ok: false, code: "CLAIM_NOT_FOUND", message: "ไม่พบคำขอเบิก" };
      if (!sameUtcMonth(claim.expenseMonth, expectedMonth)) {
        return { ok: false, code: "MONTH_MISMATCH", message: "เดือนของคำขอเบิกไม่ตรงกับเดือนที่กำลังตรวจ" };
      }
      if (!["PENDING_LEADER_CONFIRMATION", "READY_FOR_COLLECTION", "COLLECTED"].includes(claim.status)) {
        return { ok: false, code: "CLAIM_NOT_REJECTABLE", message: "สถานะปัจจุบันไม่สามารถตีกลับได้" };
      }

      const activeItems = claim.monthlyRequestItems.filter((item) =>
        ACTIVE_MRC_STATUSES.includes(item.monthlyRequestCollection.status as (typeof ACTIVE_MRC_STATUSES)[number]),
      );
      if (activeItems.some((item) => item.monthlyRequestCollection.status !== "DRAFT")) {
        return { ok: false, code: "FINALIZED_MEMBERSHIP", message: "คำขออยู่ใน monthly request ที่ปิดข้อมูลแล้ว จึงตีกลับไม่ได้" };
      }

      const revision = claim.revisions.find((item) => item.revisionNo === claim.currentRevisionNo);
      if (!revision) {
        return { ok: false, code: "CURRENT_REVISION_NOT_FOUND", message: "ไม่พบ revision ปัจจุบันของคำขอ" };
      }

      const now = new Date();
      for (const item of activeItems) {
        await tx.monthlyRequestCollectionItem.update({
          where: { id: item.id },
          data: { removedAt: now, removedById: actorId, removalReason: `ตีกลับ: ${reason}` },
        });
        await recalculateDraft(tx, item.monthlyRequestCollectionId);
      }

      await tx.leaderVerification.updateMany({
        where: { claimRevisionId: revision.id, status: { not: "SUPERSEDED" } },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      await tx.expenseClaimRevision.update({
        where: { id: revision.id },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      await tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: "REJECTED",
          rejectedAt: now,
          rejectedById: actorId,
          rejectionReason: reason,
          collectedAt: null,
        },
      });
      await tx.userActionLog.create({
        data: {
          userId: actorId,
          actionType: "CLAIM_REJECTED",
          actionDescription: `Rejected expense claim "${claim.id}" for correction`,
          targetEntityType: "ExpenseClaim",
          targetEntityId: claim.id,
          targetUserId: claim.userId,
          previousData: { status: claim.status },
          newData: { status: "REJECTED", reason },
        },
      });
      return { ok: true, claimId: claim.id, claimantId: claim.userId };
    });
  },

  async flagClaim(
    claimId: string,
    actorId: string,
    note: string,
    expectedMonth: Date,
  ): Promise<RepositoryMutationOutcome> {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.findUnique({
        where: { id: claimId },
        select: {
          id: true,
          userId: true,
          expenseMonth: true,
          reviewFlags: { where: { status: "OPEN" }, select: { id: true } },
        },
      });
      if (!claim) return { ok: false, code: "CLAIM_NOT_FOUND", message: "ไม่พบคำขอเบิก" };
      if (!sameUtcMonth(claim.expenseMonth, expectedMonth)) {
        return { ok: false, code: "MONTH_MISMATCH", message: "เดือนของคำขอเบิกไม่ตรงกับเดือนที่กำลังตรวจ" };
      }
      if (claim.reviewFlags.length > 0) {
        return { ok: false, code: "FLAG_ALREADY_OPEN", message: "คำขอนี้มีประเด็นน่าสงสัยที่ยังไม่ปิดอยู่แล้ว" };
      }
      const flag = await tx.claimReviewFlag.create({
        data: { expenseClaimId: claim.id, openedById: actorId, note },
      });
      await tx.userActionLog.create({
        data: {
          userId: actorId,
          actionType: "CLAIM_SUSPICIOUS_MARKED",
          actionDescription: `Marked expense claim "${claim.id}" as suspicious`,
          targetEntityType: "ClaimReviewFlag",
          targetEntityId: flag.id,
          targetUserId: claim.userId,
          newData: { claimId: claim.id, status: "OPEN", note },
        },
      });
      return { ok: true, claimId: claim.id, claimantId: claim.userId };
    });
  },

  async resolveFlag(
    flagId: string,
    actorId: string,
    resolutionNote: string,
  ): Promise<RepositoryMutationOutcome> {
    return prisma.$transaction(async (tx) => {
      const flag = await tx.claimReviewFlag.findUnique({
        where: { id: flagId },
        select: { id: true, expenseClaimId: true, status: true },
      });
      if (!flag) return { ok: false, code: "FLAG_NOT_FOUND", message: "ไม่พบประเด็นที่ต้องการปิด" };
      if (flag.status !== "OPEN") {
        return { ok: false, code: "FLAG_NOT_OPEN", message: "ประเด็นนี้ถูกปิดแล้ว" };
      }
      await tx.claimReviewFlag.update({
        where: { id: flag.id },
        data: {
          status: "RESOLVED",
          resolutionNote,
          resolvedById: actorId,
          resolvedAt: new Date(),
        },
      });
      await tx.userActionLog.create({
        data: {
          userId: actorId,
          actionType: "CLAIM_SUSPICIOUS_RESOLVED",
          actionDescription: `Resolved review flag "${flag.id}"`,
          targetEntityType: "ClaimReviewFlag",
          targetEntityId: flag.id,
          newData: { claimId: flag.expenseClaimId, status: "RESOLVED", resolutionNote },
        },
      });
      return { ok: true, claimId: flag.expenseClaimId };
    });
  },

  async removeFromDraft(
    claimId: string,
    actorId: string,
    reason: string,
    expectedMonth: Date,
  ): Promise<RepositoryMutationOutcome> {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.findUnique({
        where: { id: claimId },
        include: {
          revisions: {
            include: { offSiteWorks: { include: { leaderVerification: true } } },
          },
          monthlyRequestItems: {
            where: { removedAt: null },
            include: { monthlyRequestCollection: true },
          },
        },
      });
      if (!claim) return { ok: false, code: "CLAIM_NOT_FOUND", message: "ไม่พบคำขอเบิก" };
      if (!sameUtcMonth(claim.expenseMonth, expectedMonth)) {
        return { ok: false, code: "MONTH_MISMATCH", message: "เดือนของคำขอเบิกไม่ตรงกับเดือนที่กำลังตรวจ" };
      }
      const item = claim.monthlyRequestItems.find(
        (candidate) => candidate.monthlyRequestCollection.status === "DRAFT",
      );
      if (!item) {
        return { ok: false, code: "DRAFT_MEMBERSHIP_NOT_FOUND", message: "คำขอไม่ได้อยู่ใน monthly request ฉบับร่าง" };
      }
      if (claim.status !== "COLLECTED") {
        return { ok: false, code: "CLAIM_NOT_COLLECTED", message: "สถานะคำขอไม่ใช่รวบรวมแล้ว" };
      }
      if (
        claim.monthlyRequestItems.some((candidate) =>
          ["FINALIZED", "ALL_DONE"].includes(candidate.monthlyRequestCollection.status),
        )
      ) {
        return {
          ok: false,
          code: "FINALIZED_MEMBERSHIP",
          message: "คำขออยู่ใน monthly request ที่ปิดข้อมูลแล้ว จึงนำออกไม่ได้",
        };
      }

      const revision = claim.revisions.find((candidate) => candidate.revisionNo === claim.currentRevisionNo);
      if (!revision) {
        return { ok: false, code: "CURRENT_REVISION_NOT_FOUND", message: "ไม่พบ revision ปัจจุบันของคำขอ" };
      }
      const verified =
        revision.offSiteWorks.length > 0 &&
        revision.offSiteWorks.every(
          (offSiteWork) => offSiteWork.leaderVerification?.status === "CONFIRMED",
        );

      await tx.monthlyRequestCollectionItem.update({
        where: { id: item.id },
        data: {
          removedAt: new Date(),
          removedById: actorId,
          removalReason: reason,
        },
      });
      await tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: verified ? "READY_FOR_COLLECTION" : "PENDING_LEADER_CONFIRMATION",
          collectedAt: null,
        },
      });
      await recalculateDraft(tx, item.monthlyRequestCollectionId);
      await tx.userActionLog.create({
        data: {
          userId: actorId,
          actionType: "CLAIM_REMOVED_FROM_COLLECTION",
          actionDescription: `Removed expense claim "${claim.id}" from draft monthly request`,
          targetEntityType: "ExpenseClaim",
          targetEntityId: claim.id,
          previousData: {
            status: "COLLECTED",
            monthlyRequestId: item.monthlyRequestCollectionId,
          },
          newData: {
            status: verified ? "READY_FOR_COLLECTION" : "PENDING_LEADER_CONFIRMATION",
            reason,
          },
        },
      });
      return {
        ok: true,
        claimId: claim.id,
        monthlyRequestId: item.monthlyRequestCollectionId,
        batchNo: item.monthlyRequestCollection.batchNo,
      };
    });
  },
};
