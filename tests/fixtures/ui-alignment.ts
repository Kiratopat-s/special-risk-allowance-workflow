import type { ComponentProps } from "react";
import type { RolesClient } from "@/app/admin/roles/roles-client";
import type { UsersClient } from "@/app/admin/users/users-client";
import type { DepartmentsClient } from "@/app/admin/departments/departments-client";

const timestamps = {
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};
export const alignmentPermissions: ComponentProps<typeof RolesClient>["allPermissions"] = [
  {
    id: "permission-read",
    code: "expense-claim:read:department",
    name: "Read Department Expense Claims",
    description: null,
    resource: "EXPENSE_CLAIM",
    action: "READ",
    scope: "DEPARTMENT",
    isActive: true,
    isSystem: true,
    ...timestamps,
  },
  {
    id: "permission-list",
    code: "expense-claim:list:department",
    name: "List Department Expense Claims",
    description: null,
    resource: "EXPENSE_CLAIM",
    action: "LIST",
    scope: "DEPARTMENT",
    isActive: true,
    isSystem: true,
    ...timestamps,
  },
];
export const alignmentRoles: ComponentProps<typeof RolesClient>["initialRoles"] = [
  {
    id: "role-fixture",
    code: "fixture-reviewer",
    name: "ผู้ตรวจสอบเอกสารประจำหน่วยงานและพื้นที่ปฏิบัติงาน",
    description: "บทบาทสำหรับทดสอบหน้าจอ ไม่มีข้อมูลจริง",
    level: 45,
    parentRoleId: null,
    isActive: true,
    isSystem: false,
    ...timestamps,
  },
];
export const alignmentDepartments: ComponentProps<typeof DepartmentsClient>["initialDepartments"] = [
  {
    id: "department-fixture",
    name: "แผนกฝึกอบรมและตรวจสอบการปฏิบัติงานในพื้นที่พิเศษ",
    shortName: "หน่วยงานทดสอบ",
    description: null,
    parentId: null,
    parent: null,
    children: [],
    isActive: true,
    _count: { users: 3 },
    ...timestamps,
  },
];
export const alignmentUsers: ComponentProps<typeof UsersClient>["initialUsers"] = [
  {
    id: "user-fixture",
    firstName: "ผู้ใช้งานทดสอบ",
    lastName: "ชื่อสำหรับตรวจสอบการตัดบรรทัด",
    email: "layout-fixture@example.test",
    position: "ผู้ตรวจสอบ",
    departmentId: alignmentDepartments[0].id,
    departmentName: alignmentDepartments[0].name,
    roles: ["ผู้ตรวจสอบเอกสาร", "ผู้รวบรวมเอกสารประจำหน่วยงาน", "ผู้อนุมัติ"].map((name, i) => ({
      id: "role-" + i,
      code: "role-" + i,
      name,
      userRoleId: "assignment-" + i,
      departmentId: alignmentDepartments[0].id,
      departmentName: alignmentDepartments[0].name,
    })),
  },
];
export const alignmentNotifications = [
  {
    id: "notification-fixture",
    title: "แจ้งเตือนเอกสารที่ต้องตรวจสอบและดำเนินการประจำหน่วยงาน " + "DocumentReference".repeat(8),
    body: "ข้อความทดสอบการแสดงผลสองบรรทัดพร้อมรายละเอียดของการปฏิบัติงาน ".repeat(4),
    isRead: false,
    link: null,
    createdAt: timestamps.createdAt,
  },
  {
    id: "notification-read-fixture",
    title: "เอกสารที่อ่านแล้ว",
    body: "รายละเอียดสำหรับทดสอบปุ่มล้างและการจัดวางส่วนหัว",
    isRead: true,
    link: null,
    createdAt: timestamps.createdAt,
  },
];
