import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAny } from "@/lib/auth/permissions";
import { PrintRouteLayout } from "@/components/claim-print/print-route-layout";

interface MrcLayoutProps {
  children: React.ReactNode;
}

export default async function MrcLayout({ children }: MrcLayoutProps) {
  const session = await auth();

  if (!session?.user?.dbUserId) {
    redirect("/api/auth/signin");
  }

  const hasAccess = await canAny(session.user.dbUserId, [
    { resource: "MONTHLY_REQUEST", action: "READ" },
    { resource: "MONTHLY_REQUEST", action: "LIST" },
    { resource: "MONTHLY_REQUEST", action: "MANAGE" },
    { resource: "MONTHLY_REQUEST", action: "SUBMIT" },
    { resource: "MONTHLY_REQUEST", action: "APPROVE" },
  ]);

  if (!hasAccess) {
    redirect("/");
  }

  return <PrintRouteLayout>{children}</PrintRouteLayout>;
}
