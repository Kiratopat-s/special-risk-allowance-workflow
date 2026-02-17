import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, hasAnyRole } from "@/lib/auth/permissions";
import { AdminNav } from "./admin-nav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user?.dbUserId) {
    redirect("/api/auth/signin");
  }

  // Check if user has admin access
  const isAdmin = await hasAnyRole(session.user.dbUserId, [
    "super-admin",
    "admin",
  ]);

  const hasAdminPermission =
    isAdmin ||
    (await can(session.user.dbUserId, "ROLE", "LIST")) ||
    (await can(session.user.dbUserId, "USER", "MANAGE")) ||
    (await can(session.user.dbUserId, "PERMISSION", "LIST"));

  if (!hasAdminPermission) {
    redirect("/");
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
          <p className="text-sm text-muted-foreground">
            Manage roles, permissions, and user access
          </p>
        </div>

        {/* Tab Navigation */}
        <AdminNav />

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
