import { can, canExact, hasRole } from "@/lib/auth/permissions";
import { resolveClaimReadScope } from "@/lib/domains/expense-claim-document/read-scope";
import { CLAIM_STATUS_GROUPS } from "@/lib/domains/expense-claim-document/read-query";
import { dashboardRepository } from "./repository";
import type { DashboardOverview } from "./types";
import type { Result } from "@/lib/shared/types";
import type { Prisma } from "@/lib/generated/prisma/client";
export const dashboardService = {
  async getOverview(
    userId: string,
    month: string,
  ): Promise<Result<DashboardOverview>> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      return {
        success: false,
        error: "กรุณาเลือกเดือนและปี พ.ศ. ให้ถูกต้อง",
        code: "INVALID_MONTH",
      };
    try {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );
      const [
        scope,
        updateOwn,
        updateAll,
        createClaim,
        createWork,
        listMonthly,
        readMonthly,
        manage,
        superAdmin,
        hpa,
      ] = await Promise.all([
        resolveClaimReadScope(userId),
        can(userId, "EXPENSE_CLAIM", "UPDATE", { targetOwnerId: userId }),
        can(userId, "EXPENSE_CLAIM", "UPDATE", {
          targetOwnerId: "00000000-0000-0000-0000-000000000000",
        }),
        can(userId, "EXPENSE_CLAIM", "CREATE", { targetOwnerId: userId }),
        can(userId, "OFF_SITE_WORK", "CREATE"),
        can(userId, "MONTHLY_REQUEST", "LIST"),
        can(userId, "MONTHLY_REQUEST", "READ"),
        can(userId, "MONTHLY_REQUEST", "MANAGE"),
        hasRole(userId, "super-admin"),
        canExact(userId, "MONTHLY_REQUEST", "REVIEW_HPA"),
      ]);
      const actionable: Prisma.ExpenseClaimWhereInput | null =
        updateAll || updateOwn
          ? {
              status: { in: ["DRAFT", "REJECTED"] },
              ...(!updateAll && { userId }),
            }
          : null;
      const [claimData, collectionData] = await Promise.all([
        scope.success
          ? dashboardRepository.claims(
              {
                userId: scope.data.userId,
                expenseMonthFrom: start,
                expenseMonthTo: end,
              },
              actionable,
            )
          : null,
        listMonthly || readMonthly
          ? dashboardRepository.collections(start, end, {
              userId,
              ownOnly: !listMonthly,
              manage,
              superAdmin,
              hpa,
            })
          : null,
      ]);
      const nextActions: DashboardOverview["nextActions"] = [];
      if (createWork)
        nextActions.push({
          label: "สร้างคำสั่งออกนอกสถานที่",
          href: "/dashboard?tab=off-site-work&create=1",
        });
      if (createClaim)
        nextActions.push({
          label: "สร้างเอกสารเบิก",
          href: "/dashboard?tab=expense-claims&create=1",
        });
      nextActions.push({
        label: "ตรวจสอบคิวยืนยันการปฏิบัติงาน",
        href: "/dashboard?tab=leader-queue",
      });
      if (manage)
        nextActions.push({
          label: "รวบรวมเอกสารรายเดือน",
          href: "/dashboard?tab=monthly-requests",
        });
      const statuses = Object.fromEntries(
        claimData?.groups.map((group) => [group.status, group._count._all]) ||
          [],
      );
      return {
        success: true,
        data: {
          month,
          scope: scope.success ? scope.data.scope : "RESTRICTED",
          nextActions,
          claims: claimData
            ? {
                total: claimData.groups.reduce(
                  (sum, group) => sum + group._count._all,
                  0,
                ),
                requestedAmount: claimData.groups.reduce(
                  (sum, group) => sum + Number(group._sum.amount ?? 0),
                  0,
                ),
                approvedAmount: Number(
                  claimData.groups.find((group) => group.status === "APPROVED")
                    ?._sum.amount ?? 0,
                ),
                inProgress: CLAIM_STATUS_GROUPS.progress.reduce(
                  (sum, status) => sum + (statuses[status] || 0),
                  0,
                ),
                requiresAction: claimData.requiresAction,
                statuses,
                recent: await Promise.all(
                  claimData.recent.map(async (claim) => ({
                    id: claim.id,
                    title:
                      claim.expenseClaimOffSiteWorks
                        .map(
                          (link) =>
                            link.offSiteWork.objective ||
                            link.offSiteWork.innerRefDocumentId,
                        )
                        .filter(Boolean)
                        .join(" · ") || `เอกสารเบิก ${claim.id.slice(0, 8)}`,
                    claimant: `${claim.claimant.firstName} ${claim.claimant.lastName}`,
                    month: claim.expenseMonth.toISOString(),
                    status: claim.status,
                    amount: claim.amount === null ? null : Number(claim.amount),
                    days:
                      claim.countDates === null
                        ? null
                        : Number(claim.countDates),
                    canView: await can(userId, "EXPENSE_CLAIM", "READ", {
                      targetOwnerId: claim.userId,
                    }),
                  })),
                ),
              }
            : null,
          collections: collectionData
            ? {
                total: collectionData.total,
                recent: collectionData.recent.map((collection) => ({
                  id: collection.id,
                  month: collection.collectForMonth.toISOString(),
                  status: collection.status,
                  amount:
                    collection.amount === null
                      ? null
                      : Number(collection.amount),
                  claimCount: collection._count.expenseClaims,
                  steps: collection.approvalSteps.map((step) => ({
                    stage: step.stage,
                    status: step.status,
                    reviewedAt: step.reviewedAt?.toISOString() || null,
                    reviewer: step.reviewerNameAtApproval ?? (step.reviewer
                      ? `${step.reviewer.firstName} ${step.reviewer.lastName}`
                      : null),
                  })),
                })),
              }
            : null,
        },
      };
    } catch {
      return {
        success: false,
        error: "ไม่สามารถโหลดภาพรวมได้ กรุณาลองอีกครั้ง",
        code: "OVERVIEW_READ_FAILED",
      };
    }
  },
};
