import { error, success, type Result } from "@/lib/shared/types/result";
import { offSiteWorkEmployeeRepository } from "./employee-repository";
import { employeeListSchema } from "./employee-list";
import type { EmployeeListItem } from "./types";

export const offSiteWorkEmployeeService = {
  async match(employeeIds: string[]): Promise<Result<EmployeeListItem[]>> {
    if (!Array.isArray(employeeIds) || employeeIds.length > 500 || employeeIds.some((id) => typeof id !== "string" || !/^\d{6}$/.test(id))) {
      return error("รหัสพนักงานไม่ถูกต้อง", "INVALID_EMPLOYEE_IDS");
    }
    try {
      return success(await offSiteWorkEmployeeRepository.findActive([...new Set(employeeIds)]));
    } catch {
      return error("ไม่สามารถจับคู่พนักงานได้ กรุณาลองใหม่", "EMPLOYEE_MATCH_FAILED");
    }
  },

  async prepare(employees: EmployeeListItem[]): Promise<Result<EmployeeListItem[]>> {
    const parsed = employeeListSchema.safeParse(employees);
    if (!parsed.success) return error(parsed.error.issues[0].message, "INVALID_EMPLOYEES");
    if (!parsed.data.length) return success([]);
    try {
      const matches = await offSiteWorkEmployeeRepository.findActive(
        parsed.data.flatMap((employee) => employee.employeeId ? [employee.employeeId] : []),
        parsed.data.flatMap((employee) => employee.userId ? [employee.userId] : []),
      );
      const result: EmployeeListItem[] = [];
      for (const employee of parsed.data) {
        const user = employee.userId
          ? matches.find((match) => match.userId === employee.userId)
          : matches.find((match) => match.employeeId === employee.employeeId);
        if (employee.userId && (!user || (employee.employeeId && user.employeeId !== employee.employeeId))) {
          return error("บัญชีหรือรหัสพนักงานเปลี่ยนแปลง กรุณาเลือกพนักงานใหม่", "EMPLOYEE_MISMATCH");
        }
        // Preserve recorded details; an ID-only entry gets its missing names
        // from the account when one becomes available.
        result.push({
          ...employee,
          userId: user?.userId || null,
          firstName: employee.firstName.trim() ? employee.firstName : user?.firstName ?? "",
          lastName: employee.lastName.trim() ? employee.lastName : user?.lastName ?? "",
        });
      }
      const checked = employeeListSchema.safeParse(result);
      return checked.success ? success(checked.data) : error(checked.error.issues[0].message, "INVALID_EMPLOYEES");
    } catch {
      return error("ไม่สามารถตรวจสอบรายชื่อพนักงานได้ กรุณาลองใหม่", "EMPLOYEE_MATCH_FAILED");
    }
  },

  async linkForUser(userId: string): Promise<Result<number>> {
    try {
      return success(await offSiteWorkEmployeeRepository.linkForUser(userId));
    } catch {
      return error("เชื่อมรายชื่อใบนำตัวไม่สำเร็จ กรุณาลองใหม่", "EMPLOYEE_LINK_FAILED");
    }
  },
};
