import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAny } from "@/lib/auth/permissions";

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

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-6">{children}</div>
    </div>
  );
}
