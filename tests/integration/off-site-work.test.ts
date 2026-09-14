import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
vi.mock("@/lib/db", async () => {
  const url = new URL(process.env.OSW_TEST_DATABASE_URL || "http://invalid");
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/osw_test" || !process.env.OSW_TEST_CONTAINER?.startsWith("sraw-osw-test-")) {
    throw Error("Use bun run test:off-site-work-db with its disposable database");
  }
  const { PrismaClient } = await import("@/lib/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) }) };
});
vi.mock("@/lib/domains/action-log/service", () => ({ actionLogService: { log: vi.fn() } }));

import { prisma } from "@/lib/db";
import { offSiteWorkService } from "@/lib/domains/off-site-work/service";
import { offSiteWorkEmployeeService } from "@/lib/domains/off-site-work/employee-service";
import { expenseClaimDocumentService } from "@/lib/domains/expense-claim-document/service";
import { userService } from "@/lib/domains/user/service";
import type { EmployeeListItem } from "@/lib/domains/off-site-work/types";

const person: EmployeeListItem = { userId: null, employeeId: "100001", firstName: "ผู้เดินทาง", lastName: "ทดสอบ", position: "ตำแหน่งเดิม", departmentId: null, departmentName: "ฝ่ายเดิม" };
const pending = (employeeId: string): EmployeeListItem => ({ userId: null, employeeId, firstName: "", lastName: "", position: null, departmentId: null, departmentName: null });
const base = { startDate: "2026-09-01", endDate: "2026-09-30" };
beforeAll(async () => {
  await prisma.user.create({ data: { id: "author", keycloakId: "author", email: "author@example.test", firstName: "ผู้บันทึก", lastName: "ทดสอบ" } });
});
afterAll(async () => { await prisma.$disconnect(); });

describe.sequential("PDF traveler account lifecycle", () => {
  it("stores only pending numbers and takes the full registered account profile across documents", async () => {
    const idOnly: EmployeeListItem = { userId: null, employeeId: "000001", firstName: "", lastName: "", position: null, departmentId: null, departmentName: null };
    const recorded = { ...idOnly, firstName: "ชื่อที่บันทึกไว้", position: "ตำแหน่งในเอกสาร", departmentName: "สังกัดในเอกสาร" };
    const unmatched = { ...idOnly, employeeId: "000002" };
    expect((await offSiteWorkService.create({ id: "id-only", ...base, employeeList: [idOnly, unmatched] }, "author")).success).toBe(true);
    expect((await offSiteWorkService.create({ id: "id-only-edited", ...base }, "author")).success).toBe(true);
    expect((await offSiteWorkService.update("id-only-edited", { employeeList: [recorded] }, "author")).success).toBe(true);
    const before = await offSiteWorkService.getById("id-only");
    if (!before.success) throw Error(before.error);
    expect(before.data.employeeList).toEqual([idOnly, unmatched]);
    expect((await prisma.offSiteWork.findUniqueOrThrow({ where: { id: "id-only-edited" } })).employeeList).toEqual([idOnly]);

    const signup = await userService.syncFromKeycloak({ id: "id-only-account", keycloakId: "id-only-account", email: "id-only@example.test", firstName: "ชื่อจากบัญชี", lastName: "นามสกุลจากบัญชี", employeeId: "000001", position: "ตำแหน่งจากบัญชี", department: "ฝ่ายจากบัญชี", departmentShort: "ฝบ." });
    if (!signup.success) throw Error(signup.error);
    const linked = { ...idOnly, userId: signup.data.id, firstName: signup.data.firstName, lastName: signup.data.lastName, position: "ตำแหน่งจากบัญชี", departmentId: signup.data.departmentId, departmentName: "ฝบ." };
    expect((await prisma.offSiteWork.findUniqueOrThrow({ where: { id: "id-only" } })).employeeList).toEqual([linked, unmatched]);
    expect((await prisma.offSiteWork.findUniqueOrThrow({ where: { id: "id-only-edited" } })).employeeList).toEqual([
      linked,
    ]);
    expect(await offSiteWorkEmployeeService.linkForUser(signup.data.id)).toMatchObject({ success: true, data: 0 });
    const eligible = await expenseClaimDocumentService.listEligibleOffSiteWorksForUser(signup.data.id, new Date("2026-09-01"));
    if (!eligible.success) throw Error(eligible.error);
    expect(eligible.data.map((item) => item.id)).toEqual(expect.arrayContaining(["id-only", "id-only-edited"]));

    const saved = await offSiteWorkService.create({ id: "id-only-existing-account", ...base, employeeList: [idOnly] }, "author");
    if (!saved.success) throw Error(saved.error);
    expect(saved.data.employeeList).toEqual([linked]);
  });

  it("links when an existing account receives its employee number during profile sync", async () => {
    const profile = { id: "late-number", keycloakId: "late-number", email: "late-number@example.test", firstName: "ชื่อภายหลัง", lastName: "ทดสอบ" };
    const signup = await userService.syncFromKeycloak(profile);
    if (!signup.success) throw Error(signup.error);
    const idOnly = { ...person, employeeId: "000003", firstName: "", lastName: "" };
    expect((await offSiteWorkService.create({ id: "late-number", ...base, employeeList: [idOnly] }, "author")).success).toBe(true);
    expect((await userService.syncFromKeycloak({ ...profile, employeeId: "000003" })).success).toBe(true);
    expect((await prisma.offSiteWork.findUniqueOrThrow({ where: { id: "late-number" } })).employeeList).toEqual([
      { ...pending("000003"), userId: signup.data.id, firstName: profile.firstName, lastName: profile.lastName },
    ]);
  });

  it("stores all travelers, links on signup, and makes the work eligible for claims", async () => {
    const created = await offSiteWorkService.create({ id: "TZ26010001", ...base, employeeList: [person, { ...person, employeeId: "100002" }] }, "author");
    expect(created.success).toBe(true);
    const signup = await userService.syncFromKeycloak({ id: "new-account", keycloakId: "new-account", email: "new@example.test", firstName: "ชื่อในระบบ", lastName: "ทดสอบ", employeeId: "100001" });
    if (!signup.success) throw Error(signup.error);
    const record = await offSiteWorkService.getById("TZ26010001");
    if (!record.success) throw Error(record.error);
    expect(record.data.employeeList).toEqual([{ ...pending("100001"), userId: signup.data.id, firstName: "ชื่อในระบบ", lastName: "ทดสอบ" }, pending("100002")]);
    expect(await offSiteWorkEmployeeService.linkForUser(signup.data.id)).toMatchObject({ success: true, data: 0 });
    const options = await expenseClaimDocumentService.listEligibleOffSiteWorksForUser(signup.data.id, new Date("2026-09-01"));
    if (!options.success) throw Error(options.error);
    expect(options.data.map((item) => item.id)).toContain("TZ26010001");
  });

  it("does not link inactive accounts or steal an existing link", async () => {
    await prisma.user.create({ data: { id: "inactive", keycloakId: "inactive", email: "inactive@example.test", firstName: "พักใช้", lastName: "ทดสอบ", employeeId: "100002", status: "INACTIVE" } });
    expect(await offSiteWorkEmployeeService.linkForUser("inactive")).toMatchObject({ success: true, data: 0 });
    expect(await offSiteWorkEmployeeService.linkForUser("author")).toMatchObject({ success: true, data: 0 });
    const item = await prisma.offSiteWork.findUniqueOrThrow({ where: { id: "TZ26010001" } });
    expect((item.employeeList as unknown as EmployeeListItem[])[1].userId).toBeNull();
  });

  it("preserves concurrent document edits and other links while replacing untrusted traveler details", async () => {
    for (const code of ["100003", "100004"]) {
      await prisma.user.create({ data: { id: code, keycloakId: code, email: `${code}@example.test`, firstName: "พร้อมกัน", lastName: "ทดสอบ", employeeId: code } });
    }
    await prisma.offSiteWork.create({ data: { id: "concurrent", startDate: new Date(base.startDate), endDate: new Date(base.endDate), postedByUserId: "author", employeeList: [{ ...person, employeeId: "100003" }, { ...person, employeeId: "100004" }] } });
    const client = new Client({ connectionString: process.env.OSW_TEST_DATABASE_URL });
    try {
      await client.connect();
      await client.query("BEGIN");
      await client.query("UPDATE off_site_works SET objective = 'แก้ไขพร้อมกัน' WHERE id = 'concurrent'");
      const first = offSiteWorkEmployeeService.linkForUser("100003");
      const second = offSiteWorkEmployeeService.linkForUser("100004");
      await client.query("COMMIT");
      expect((await first).success).toBe(true);
      expect((await second).success).toBe(true);
    } finally { await client.end(); }
    const saved = await prisma.offSiteWork.findUniqueOrThrow({ where: { id: "concurrent" } });
    expect(saved.objective).toBe("แก้ไขพร้อมกัน");
    expect(saved.employeeList).toEqual(["100003", "100004"].map((employeeId) => ({
      ...pending(employeeId), userId: employeeId, firstName: "พร้อมกัน", lastName: "ทดสอบ",
    })));
  });

  it("reconciles late matches on save and before claim lookup without changing linked identities", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { employeeId: "100001" } });
    const result = await offSiteWorkService.create({ id: "save-match", ...base, employeeList: [person] }, "author");
    if (!result.success) throw Error(result.error);
    expect(result.data.employeeList?.[0].userId).toBe(user.id);
    await prisma.offSiteWork.create({ data: { id: "retry-match", startDate: new Date(base.startDate), endDate: new Date(base.endDate), postedByUserId: "author", employeeList: [person] } });
    const options = await expenseClaimDocumentService.listEligibleOffSiteWorksForUser(user.id, new Date("2026-09-01"));
    if (!options.success) throw Error(options.error);
    expect(options.data.map((item) => item.id)).toContain("retry-match");
    await prisma.offSiteWork.update({ where: { id: "retry-match" }, data: { employeeList: [{ ...person, userId: "author" }] } });
    await offSiteWorkEmployeeService.linkForUser(user.id);
    const saved = await prisma.offSiteWork.findUniqueOrThrow({ where: { id: "retry-match" } });
    expect((saved.employeeList as unknown as EmployeeListItem[])[0].userId).toBe("author");
  });
});
