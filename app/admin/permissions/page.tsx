import { listPermissions } from "@/app/actions/permissions";
import { PermissionsClient } from "./permissions-client";

export default async function PermissionsPage() {
  const result = await listPermissions();
  const permissions = result.success ? result.data : [];

  return <PermissionsClient permissions={permissions} />;
}
