import type { ExpenseClaimDocumentFilterCriteria } from "@/lib/domains/expense-claim-document/types";
import type { ClaimDocumentStatus } from "@/lib/shared/types";
const statuses: ClaimDocumentStatus[] = [
  "DRAFT",
  "PENDING",
  "PENDING_LEADER_VERIFY",
  "WAIT_FOR_COLLECTION",
  "COLLECTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];
export function parseClaimListQuery(
  query: URLSearchParams,
): ExpenseClaimDocumentFilterCriteria {
  const status = query.get("status") as ClaimDocumentStatus;
  const group = query.get("statusGroup");
  const sort = query.get("sort");
  const month = query.get("month");
  const validMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const start = validMonth ? new Date(`${month}-01T00:00:00Z`) : undefined;
  const page = Number(query.get("page") || 1);
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    search: query.get("search") || undefined,
    status: statuses.includes(status) ? status : undefined,
    statusGroup:
      group === "attention" || group === "progress" || group === "approved"
        ? group
        : undefined,
    sort: sort === "amount-asc" || sort === "amount-desc" ? sort : undefined,
    ...(status === "CANCELLED" ? { includeCancelled: true } : {}),
    ...(start && {
      expenseMonthFrom: start.toISOString(),
      expenseMonthTo: new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      ).toISOString(),
    }),
  };
}
export function updateListQuery(
  current: string,
  changes: Record<string, string | number | undefined>,
  resetPage = true,
): string {
  const query = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") query.delete(key);
    else query.set(key, String(value));
  }
  if (resetPage) query.delete("page");
  query.delete("claimId");
  query.delete("view");
  query.delete("create");
  return query.toString();
}
