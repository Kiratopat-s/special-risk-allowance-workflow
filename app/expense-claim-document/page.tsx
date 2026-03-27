import { listExpenseClaimDocuments } from "@/app/actions/expense-claim-document";
import { auth } from "@/lib/auth";
import { ExpenseClaimDocumentClient } from "@/app/expense-claim-document/expense-claim-document-client";

function getLockedClaimantPosition(
  positionShort?: string | null,
  positionLevel?: string | null,
): string {
  const short = (positionShort ?? "").trim();
  const level = (positionLevel ?? "").trim();

  if (!short) return "-";

  const shortOnlyKeywords = ["ชผ", "หผ", "รก", "อก"];
  const shouldUseShortOnly = shortOnlyKeywords.some((keyword) =>
    short.includes(keyword),
  );

  if (shouldUseShortOnly || !level) return short;

  return `${short} ${level}`.trim();
}

interface ExpenseClaimDocumentPageProps {
  searchParams?: Promise<{
    claimId?: string;
  }>;
}

export default async function ExpenseClaimDocumentPage({
  searchParams,
}: ExpenseClaimDocumentPageProps) {
  const session = await auth();
  const resolvedSearchParams = await searchParams;
  const result = await listExpenseClaimDocuments({ page: 1, pageSize: 20 });

  const currentUserDisplayName =
    session?.user?.firstName || session?.user?.lastName
      ? `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim()
      : session?.user?.name || "Current User";

  const currentUserClaimantPositionAtSubmission = getLockedClaimantPosition(
    session?.user?.positionShort,
    session?.user?.positionLevel,
  );

  const data = result.success
    ? { items: result.data.data, pagination: result.data.pagination }
    : { items: [], pagination: null };

  return (
    <ExpenseClaimDocumentClient
      initialItems={data.items}
      initialPagination={data.pagination}
      initialViewId={resolvedSearchParams?.claimId ?? null}
      currentUserDisplayName={currentUserDisplayName}
      currentUserClaimantPositionAtSubmission={
        currentUserClaimantPositionAtSubmission
      }
    />
  );
}
