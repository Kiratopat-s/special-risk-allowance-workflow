import { prisma } from "@/lib/db";
import type { EmployeeListItem } from "./types";

export const offSiteWorkEmployeeRepository = {
  async findActive(employeeIds: string[], userIds: string[] = []): Promise<EmployeeListItem[]> {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE", OR: [{ employeeId: { in: employeeIds } }, { id: { in: userIds } }] },
      select: { id: true, employeeId: true, firstName: true, lastName: true, position: true,
        departmentId: true, department: { select: { name: true, shortName: true } } },
    });
    return users.map(({ id, department, ...user }) => ({ ...user, userId: id,
      departmentName: department?.shortName || department?.name || null }));
  },

  // PostgreSQL locks each target row and evaluates the expression against its
  // latest JSON. Never read/replace the whole employee list in application code.
  async linkForUser(userId: string): Promise<number> {
    return prisma.$executeRaw`
      UPDATE off_site_works AS osw
      SET employee_list = (
        SELECT jsonb_agg(
          CASE WHEN NULLIF(emp->>'userId', '') IS NULL AND emp->>'employeeId' = u.employee_id
            THEN emp || jsonb_build_object(
              'userId', u.id,
              'firstName', u.first_name,
              'lastName', u.last_name,
              'position', u.position,
              'departmentId', u.department_id,
              'departmentName', COALESCE(NULLIF(d.short_name, ''), d.name)
            ) ELSE emp END ORDER BY ordinal
        ) FROM jsonb_array_elements(osw.employee_list) WITH ORDINALITY AS entries(emp, ordinal)
      ), updated_at = CURRENT_TIMESTAMP
      FROM users AS u LEFT JOIN departments AS d ON d.id = u.department_id
      WHERE u.id = ${userId} AND u.status = 'ACTIVE' AND u.employee_id IS NOT NULL
        AND osw.deleted_at IS NULL AND jsonb_typeof(osw.employee_list) = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(osw.employee_list) AS emp
          WHERE NULLIF(emp->>'userId', '') IS NULL AND emp->>'employeeId' = u.employee_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(osw.employee_list) AS emp WHERE emp->>'userId' = u.id
        )
    `;
  },
};
