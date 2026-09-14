import { departmentService } from "./service";

export const DEFAULT_DEPARTMENTS = [
  { name: "ประจำกอง", shortName: "ปจก." },
  { name: "แผนกฝึกอบรมช่าง", shortName: "ผอช." },
  { name: "แผนกฝึกอบรมงานฮอทไลน์", shortName: "ผอฮ." },
  { name: "แผนกพัฒนามาตรฐานงานฮอทไลน์", shortName: "ผมฮ." },
  { name: "แผนกพัฒนาอุปกรณ์เครื่องมืองานฮอทไลน์", shortName: "ผคฮ." },
] as const;

export async function seedDepartments(): Promise<{
  departmentsCreated: number;
  departmentsExisting: number;
  conflicts: string[];
}> {
  let departmentsCreated = 0;
  let departmentsExisting = 0;
  const conflicts: string[] = [];

  for (const department of DEFAULT_DEPARTMENTS) {
    const result = await departmentService.seedDefault(department);
    if (!result.success) {
      if (result.code !== "DEPARTMENT_SEED_CONFLICT") {
        throw new Error(result.error);
      }
      conflicts.push(result.error);
    } else if (result.data === "created") {
      departmentsCreated++;
    } else {
      departmentsExisting++;
    }
  }

  return { departmentsCreated, departmentsExisting, conflicts };
}
