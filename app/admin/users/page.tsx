import { listUsersWithRoles, listRoles } from "@/app/actions/permissions";
import { listDepartments } from "@/app/actions/department";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const [usersResult, rolesResult, departmentsResult] = await Promise.all([
    listUsersWithRoles(),
    listRoles(),
    listDepartments(),
  ]);

  const users = usersResult.success ? usersResult.data : [];
  const roles = rolesResult.success ? rolesResult.data : [];
  const departments = departmentsResult.success ? departmentsResult.data : [];

  return (
    <UsersClient
      initialUsers={users}
      allRoles={roles}
      allDepartments={departments}
    />
  );
}
