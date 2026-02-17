import { listAllDepartments } from "@/app/actions/department";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const departmentsResult = await listAllDepartments({
    // Fetch all departments (both active and inactive) for client-side filtering
  });

  const departments = departmentsResult.success ? departmentsResult.data : [];

  return <DepartmentsClient initialDepartments={departments} />;
}
