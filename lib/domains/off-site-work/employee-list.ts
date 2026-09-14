import { z } from "zod";
import type { EmployeeListItem } from "./types";

const reviewedText = z.string().max(1000).refine((value) => !/[\u0000\uFFFD]/.test(value), "กรุณาแก้ไขอักษรที่อ่านไม่ครบ (�)");
export const employeeListSchema = z.array(z.object({
  userId: z.string().min(1).max(100).nullable(),
  employeeId: reviewedText.trim().nullable(),
  firstName: reviewedText.trim(),
  lastName: reviewedText,
  position: reviewedText.nullable(),
  departmentId: z.string().max(100).nullable(),
  departmentName: reviewedText.nullable(),
}).superRefine((employee, context) => {
  if (!employee.userId && (!employee.employeeId || !/^\d{6}$/.test(employee.employeeId))) {
    context.addIssue({ code: "custom", path: ["employeeId"], message: "รายชื่อที่ยังไม่เชื่อมบัญชีต้องมีรหัสพนักงาน 6 หลัก" });
  }
})).max(500).superRefine((employees, context) => {
  const users = new Set<string>();
  const codes = new Set<string>();
  employees.forEach((employee, index) => {
    if ((employee.userId && users.has(employee.userId)) || (employee.employeeId && codes.has(employee.employeeId))) {
      context.addIssue({ code: "custom", path: [index], message: "พบรายชื่อพนักงานซ้ำ" });
    }
    if (employee.userId) users.add(employee.userId);
    if (employee.employeeId) codes.add(employee.employeeId);
  });
});

export function employeeKey(employee: EmployeeListItem): string {
  return employee.userId ? `user:${employee.userId}` : `employee:${employee.employeeId}`;
}

/** An unregistered traveler has no personal data until an account is found. */
export function pendingEmployee(employeeId: string | null): EmployeeListItem {
  return {
    userId: null,
    employeeId: employeeId?.trim() ?? null,
    firstName: "",
    lastName: "",
    position: null,
    departmentId: null,
    departmentName: null,
  };
}
export function sameEmployee(a: EmployeeListItem, b: EmployeeListItem): boolean {
  return Boolean((a.userId && a.userId === b.userId) || (a.employeeId && /^\d{6}$/.test(a.employeeId) && a.employeeId === b.employeeId));
}
export function mergeEmployees(current: EmployeeListItem[], incoming: EmployeeListItem[]): EmployeeListItem[] {
  const merged = current.map((employee) => employee.userId ? employee : pendingEmployee(employee.employeeId));
  for (const employee of incoming) {
    const index = merged.findIndex((existing) => sameEmployee(existing, employee));
    if (index < 0) merged.push(employee.userId ? employee : pendingEmployee(employee.employeeId));
    else if (!merged[index].userId && employee.userId) merged[index] = employee;
  }
  return merged;
}

export function validWorkDate(value: Date | string): boolean {
  if (!(value instanceof Date) && typeof value !== "string") return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  if (typeof value === "string") {
    const day = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || date.toISOString().slice(0, 10) !== day) return false;
  }
  return true;
}
