import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  claimWhere,
  claimOrderBy,
} from "@/lib/domains/expense-claim-document/read-query";
import type { ExpenseClaimDocumentFilterCriteria } from "@/lib/domains/expense-claim-document/types";
import {
  collectionVisibilityWhere,
  type CollectionReadAccess,
} from "@/lib/domains/monthly-request-collection/read-policy";
export const dashboardRepository = {
  async claims(
    criteria: ExpenseClaimDocumentFilterCriteria,
    actionable: Prisma.ExpenseClaimWhereInput | null,
    visibilityWhere: Prisma.ExpenseClaimWhereInput = {},
  ) {
    const where: Prisma.ExpenseClaimWhereInput = { AND: [claimWhere(criteria), visibilityWhere] };
    // Aggregates use the full authorized set. Only the recent document table has a limit.
    const [groups, recent, requiresAction] = await Promise.all([
      prisma.expenseClaim.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.expenseClaim.findMany({
        where,
        orderBy: claimOrderBy(),
        take: 6,
        select: {
          id: true,
          userId: true,
          expenseMonth: true,
          status: true,
          amount: true,
          countDates: true,
          claimant: { select: { firstName: true, lastName: true, departmentId: true } },
          expenseClaimOffSiteWorks: {
            select: {
              offSiteWork: {
                select: { objective: true, innerRefDocumentId: true },
              },
            },
          },
        },
      }),
      actionable
        ? prisma.expenseClaim.count({ where: { AND: [where, actionable] } })
        : Promise.resolve(0),
    ]);
    return { groups, recent, requiresAction };
  },
  async collections(
    monthStart: Date,
    monthEnd: Date,
    access: CollectionReadAccess,
  ) {
    const where: Prisma.MonthlyRequestCollectionWhereInput = {
      AND: [
        collectionVisibilityWhere(access),
        {
          collectForMonth: { gte: monthStart, lte: monthEnd },
          cancelledAt: null,
        },
      ],
    };
    const [total, recent] = await Promise.all([
      prisma.monthlyRequestCollection.count({ where }),
      prisma.monthlyRequestCollection.findMany({
        where,
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          collectForMonth: true,
          status: true,
          amount: true,
          _count: { select: { expenseClaims: true } },
          approvalSteps: {
            select: {
              stage: true,
              reviewerNameAtApproval: true,
              status: true,
              reviewedAt: true,
              reviewer: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);
    return { total, recent };
  },
};
