import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAny } from "@/lib/auth/permissions";
import { PrintRouteLayout } from "@/components/claim-print/print-route-layout";

interface ExpenseClaimDocumentLayoutProps {
  children: React.ReactNode;
}

export default async function ExpenseClaimDocumentLayout({
  children,
}: ExpenseClaimDocumentLayoutProps) {
  const session = await auth();

  if (!session?.user?.dbUserId) {
    redirect("/api/auth/signin");
  }

  const hasAccess = await canAny(session.user.dbUserId, [
    { resource: "EXPENSE_CLAIM", action: "READ" },
    { resource: "EXPENSE_CLAIM", action: "LIST" },
    { resource: "EXPENSE_CLAIM", action: "CREATE" },
    { resource: "EXPENSE_CLAIM", action: "MANAGE" },
  ]);

  if (!hasAccess) {
    redirect("/");
  }

  return <PrintRouteLayout>{children}</PrintRouteLayout>;
}
