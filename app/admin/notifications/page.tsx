import { listUsersWithRoles } from "@/app/actions/permissions";
import { NotificationsAdminClient } from "./notifications-client";

export default async function AdminNotificationsPage() {
  const usersResult = await listUsersWithRoles();
  const users = usersResult.success ? usersResult.data : [];

  return <NotificationsAdminClient users={users} />;
}
