import { listUsersWithRoles } from "@/app/actions/permissions";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { NotificationsAdminClient } from "./notifications-client";
import { NotificationsAdminTabs } from "./notifications-tabs";

export default async function AdminNotificationsPage() {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) redirect("/api/auth/signin");
  if (!(await hasRole(userId, "super-admin"))) redirect("/dashboard");

  const usersResult = await listUsersWithRoles();
  const users = usersResult.success ? usersResult.data : [];

  return <NotificationsAdminTabs><NotificationsAdminClient users={users} /></NotificationsAdminTabs>;
}
