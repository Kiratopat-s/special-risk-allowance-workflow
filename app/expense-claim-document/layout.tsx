import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAny } from "@/lib/auth/permissions";

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

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-6">{children}</div>
    </div>
  );
}
