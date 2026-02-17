import { listRoles, listPermissions } from "@/app/actions/permissions";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  const [rolesResult, permissionsResult] = await Promise.all([
    listRoles(),
    listPermissions(),
  ]);

  const roles = rolesResult.success ? rolesResult.data : [];
  const permissions = permissionsResult.success ? permissionsResult.data : [];

  return <RolesClient initialRoles={roles} allPermissions={permissions} />;
}
