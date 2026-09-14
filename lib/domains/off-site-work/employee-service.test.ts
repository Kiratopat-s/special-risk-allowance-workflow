import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./employee-repository");
import { offSiteWorkEmployeeRepository as repository } from "./employee-repository";
import { offSiteWorkEmployeeService as service } from "./employee-service";
import { employeeListSchema, mergeEmployees, validWorkDate } from "./employee-list";
import type { EmployeeListItem } from "./types";

const person: EmployeeListItem = { userId: null, employeeId: "100001", firstName: "สมชาย", lastName: "ตัวอย่าง", position: "ช่าง", departmentId: null, departmentName: "ฝ่ายเดิม" };
beforeEach(() => { vi.resetAllMocks(); });
describe("employee import and matching", () => {
  const idOnly: EmployeeListItem = { userId: null, employeeId: "000001", firstName: "", lastName: "", position: null, departmentId: null, departmentName: null };
  it("accepts just a six-digit employee number and preserves leading zeros", async () => {
    vi.mocked(repository.findActive).mockResolvedValue([]);
    expect(await service.prepare([{ ...idOnly, employeeId: " 000001 " }]))
      .toEqual({ success: true, data: [idOnly] });
    expect(repository.findActive).toHaveBeenCalledWith(["000001"], []);
  });
  it("fills missing names on an exact account match without replacing recorded details", async () => {
    const account = { ...person, employeeId: "000001", userId: "user-1" };
    vi.mocked(repository.findActive).mockResolvedValue([account]);
    expect(await service.prepare([idOnly])).toEqual({ success: true, data: [
      { ...idOnly, userId: "user-1", firstName: account.firstName, lastName: account.lastName },
    ] });
    expect(await service.prepare([{ ...idOnly, firstName: "ชื่อในเอกสาร" }])).toEqual({ success: true, data: [
      { ...idOnly, userId: "user-1", firstName: "ชื่อในเอกสาร", lastName: account.lastName },
    ] });
  });
  it("rejects invalid and duplicate employee numbers even without names", async () => {
    for (const employeeId of [null, "", "00001", "0000001", "00000x"]) {
      expect((await service.prepare([{ ...idOnly, employeeId }])).success).toBe(false);
    }
    expect((await service.prepare([idOnly, { ...idOnly, employeeId: " 000001 " }])).success).toBe(false);
    expect(repository.findActive).not.toHaveBeenCalled();
  });
  it("keeps unmatched travelers, links exact codes, and preserves the document snapshot", async () => {
    vi.mocked(repository.findActive).mockResolvedValue([{ ...person, userId: "user-1", departmentName: "ฝ่ายใหม่" }]);
    const result = await service.prepare([person, { ...person, employeeId: "100002" }]);
    expect(result).toEqual({ success: true, data: [{ ...person, userId: "user-1" }, { ...person, employeeId: "100002" }] });
  });
  it("rejects forged account/code pairs", async () => {
    vi.mocked(repository.findActive).mockResolvedValue([{ ...person, userId: "user-1", employeeId: "100002" }]);
    expect(await service.prepare([{ ...person, userId: "user-1" }])).toMatchObject({ success: false, code: "EMPLOYEE_MISMATCH" });
  });
  it("validates lost glyphs, missing identities and duplicates before querying", async () => {
    for (const employees of [[{ ...person, firstName: "สม�ชาย" }], [{ ...person, employeeId: null }], [person, person]]) {
      expect((await service.prepare(employees)).success).toBe(false);
    }
    expect(repository.findActive).not.toHaveBeenCalled();
    expect((await service.match(["100001 OR TRUE"])).success).toBe(false);
  });
  it("reports retryable linking failure", async () => {
    vi.mocked(repository.linkForUser).mockRejectedValue(Error("database unavailable"));
    expect(await service.linkForUser("user-1")).toMatchObject({ success: false, code: "EMPLOYEE_LINK_FAILED" });
  });
  it("merges by either identity without discarding manually edited names", () => {
    expect(mergeEmployees([person], [{ ...person, userId: "user-1", firstName: "เปลี่ยนชื่อ" }, { ...person, employeeId: "100002" }]))
      .toEqual([person, { ...person, employeeId: "100002" }]);
  });
  it("accepts legacy linked users without an employee code and rejects invalid dates", () => {
    expect(employeeListSchema.safeParse([{ ...person, userId: "legacy", employeeId: null }]).success).toBe(true);
    expect(validWorkDate("2026-02-31")).toBe(false);
    expect(validWorkDate("2026-08-31")).toBe(true);
    expect(validWorkDate("")).toBe(false);
  });
});
