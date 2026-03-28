import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAny } from "@/lib/auth/permissions";

interface OffSiteWorkLayoutProps {
  children: React.ReactNode;
}

export default async function OffSiteWorkLayout({
  children,
}: OffSiteWorkLayoutProps) {
  const session = await auth();

  if (!session?.user?.dbUserId) {
    redirect("/api/auth/signin");
  }

  // Check if user has any off-site work permissions
  const hasAccess = await canAny(session.user.dbUserId, [
    { resource: "OFF_SITE_WORK", action: "READ" },
    { resource: "OFF_SITE_WORK", action: "LIST" },
    { resource: "OFF_SITE_WORK", action: "CREATE" },
    { resource: "OFF_SITE_WORK", action: "MANAGE" },
  ]);

  if (!hasAccess) {
    redirect("/");
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-6">{children}</div>
    </div>
  );
}
