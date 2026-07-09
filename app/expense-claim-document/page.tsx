import { redirect } from "next/navigation";

interface ExpenseClaimDocumentPageProps {
  searchParams?: Promise<{
    claimId?: string;
    view?: string;
  }>;
}

export default async function ExpenseClaimDocumentPage({
  searchParams,
}: ExpenseClaimDocumentPageProps) {
  const resolvedSearchParams = await searchParams;
  const claimId = resolvedSearchParams?.claimId ?? resolvedSearchParams?.view;
  const suffix = claimId ? `&claimId=${encodeURIComponent(claimId)}` : "";

  redirect(`/dashboard?tab=expense-claims${suffix}`);
}
