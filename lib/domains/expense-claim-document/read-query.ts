import type { Prisma } from "@/lib/generated/prisma/client";
import type { ExpenseClaimDocumentFilterCriteria } from "./types";
export const CLAIM_STATUS_GROUPS = {
  attention: ["DRAFT", "REJECTED"],
  progress: [
    "PENDING",
    "PENDING_LEADER_VERIFY",
    "WAIT_FOR_COLLECTION",
    "COLLECTED",
  ],
  approved: ["APPROVED"],
} as const;
export function claimWhere(
  criteria: ExpenseClaimDocumentFilterCriteria,
): Prisma.ExpenseClaimWhereInput {
  const {
    search,
    userId,
    createdById,
    status,
    statusGroup,
    expenseMonthFrom,
    expenseMonthTo,
    includeCancelled = false,
  } = criteria;
  return {
    ...(!includeCancelled && { cancelledAt: null }),
    ...(userId && { userId }),
    ...(createdById && { createdById }),
    ...(status
      ? { status }
      : statusGroup && CLAIM_STATUS_GROUPS[statusGroup]
        ? { status: { in: [...CLAIM_STATUS_GROUPS[statusGroup]] } }
        : {}),
    ...((expenseMonthFrom || expenseMonthTo) && {
      expenseMonth: {
        ...(expenseMonthFrom && { gte: new Date(expenseMonthFrom) }),
        ...(expenseMonthTo && { lte: new Date(expenseMonthTo) }),
      },
    }),
    ...(search && {
      OR: [
        { id: { contains: search, mode: "insensitive" } },
        { remark: { contains: search, mode: "insensitive" } },
        {
          claimant: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { employeeId: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ],
    }),
  };
}
export function claimOrderBy(
  sort?: ExpenseClaimDocumentFilterCriteria["sort"],
): Prisma.ExpenseClaimOrderByWithRelationInput[] {
  const legacy: Prisma.ExpenseClaimOrderByWithRelationInput[] = [
    { expenseMonth: "desc" },
    { createdAt: "desc" },
  ];
  return sort === "amount-asc" || sort === "amount-desc"
    ? [{ amount: sort === "amount-asc" ? "asc" : "desc" }, ...legacy]
    : legacy;
}
