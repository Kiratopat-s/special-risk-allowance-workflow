vi.mock("@/lib/domains/off-site-work/employee-service", () => ({ offSiteWorkEmployeeService: { linkForUser: vi.fn(async () => ({ success: true, data: 0 })), prepare: vi.fn(async (data) => ({ success: true, data })) } }));
vi.mock("./repository");
vi.mock("@/lib/domains/action-log/service");
vi.mock("@/lib/domains/department/service");
vi.mock("@/lib/domains/permission/repository");

import { userRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { departmentService } from "@/lib/domains/department/service";
import { userRoleRepository, roleRepository } from "@/lib/domains/permission/repository";
import { userService } from "./service";
import { offSiteWorkEmployeeService } from "@/lib/domains/off-site-work/employee-service";
import { EMPLOYEE_ID_ALREADY_LINKED, EMPLOYEE_ID_ALREADY_LINKED_MESSAGE } from "./errors";

const repo = userRepository as unknown as {
  findById: vi.Mock;
  findByKeycloakId: vi.Mock;
  findByEmployeeId: vi.Mock;
  create: vi.Mock;
  update: vi.Mock;
  updateLastLogin: vi.Mock;
  delete: vi.Mock;
  findMany: vi.Mock;
};

const mockLogService = actionLogService as unknown as { log: vi.Mock };
const mockDeptService = departmentService as unknown as { resolveFromKeycloak: vi.Mock };

beforeEach(() => {
  mockDeptService.resolveFromKeycloak.mockResolvedValue({ success: true, data: null });
  repo.findByEmployeeId.mockReset().mockResolvedValue(null);
});
const mockRoleRepo = roleRepository as unknown as { findByCode: vi.Mock };
const mockUserRoleRepo = userRoleRepository as unknown as { assign: vi.Mock };

const makeUser = (overrides = {}) => ({
  id: "u1",
  keycloakId: "kc1",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  status: "ACTIVE",
  employeeId: "123456",
  departmentId: null,
  ...overrides,
});

describe("userService", () => {
  describe("syncFromKeycloak", () => {
    const profile = {
      id: "kc1",
      keycloakId: "kc1",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      peaEmail: "test@pea.co.th",
      employeeId: "123456",
      phoneNumber: "0812345678",
      position: "Engineer",
      positionShort: "Eng",
      positionLevel: "L5",
    };

    it.each(["ACTIVE", "INACTIVE", "SUSPENDED"])("rejects a new email using an employee ID owned by a %s account before any writes", async (status) => {
      repo.findByKeycloakId.mockResolvedValue(null);
      repo.findByEmployeeId.mockResolvedValue(makeUser({ keycloakId: "original-account", email: "original@example.com", status }));

      expect(await userService.syncFromKeycloak(profile)).toMatchObject({
        success: false,
        code: EMPLOYEE_ID_ALREADY_LINKED,
        error: EMPLOYEE_ID_ALREADY_LINKED_MESSAGE,
      });
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(mockDeptService.resolveFromKeycloak).not.toHaveBeenCalled();
      expect(mockLogService.log).not.toHaveBeenCalled();
      expect(mockRoleRepo.findByCode).not.toHaveBeenCalled();
      expect(offSiteWorkEmployeeService.linkForUser).not.toHaveBeenCalled();
    });

    it("rejects an existing account trying to change to another account's employee ID", async () => {
      repo.findByKeycloakId.mockResolvedValue(makeUser({ employeeId: "654321" }));
      repo.findByEmployeeId.mockResolvedValue(makeUser({ id: "original-user", keycloakId: "original-account", email: "original@example.com" }));

      expect(await userService.syncFromKeycloak(profile)).toMatchObject({ success: false, code: EMPLOYEE_ID_ALREADY_LINKED });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("allows the owning Keycloak account to sign in and sync a changed email", async () => {
      repo.findByKeycloakId.mockResolvedValue(makeUser());
      repo.findByEmployeeId.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(makeUser({ email: "updated@example.com" }));

      expect(await userService.syncFromKeycloak({ ...profile, email: "updated@example.com" })).toMatchObject({ success: true });
      expect(repo.update).toHaveBeenCalledWith("u1", expect.objectContaining({ email: "updated@example.com", employeeId: "123456" }));
    });

    it("checks the trimmed employee ID so surrounding whitespace cannot bypass ownership", async () => {
      repo.findByKeycloakId.mockResolvedValue(null);
      repo.findByEmployeeId.mockResolvedValue(makeUser({ keycloakId: "original-account" }));

      expect(await userService.syncFromKeycloak({ ...profile, employeeId: " 123456 " })).toMatchObject({ success: false, code: EMPLOYEE_ID_ALREADY_LINKED });
      expect(repo.findByEmployeeId).toHaveBeenCalledWith("123456");
    });

    it.each([undefined, "", "   "])("preserves sign-in without an employee ID (%s)", async (employeeId) => {
      repo.findByKeycloakId.mockResolvedValue(makeUser({ employeeId: null }));
      repo.update.mockResolvedValue(makeUser({ employeeId: null }));

      expect(await userService.syncFromKeycloak({ ...profile, employeeId })).toMatchObject({ success: true });
      expect(repo.findByEmployeeId).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith("u1", expect.objectContaining({ employeeId: undefined }));
    });

    it.each(["create", "update"] as const)("reports ownership conflicts when a concurrent sign-in wins the %s race", async (operation) => {
      repo.findByKeycloakId.mockResolvedValue(operation === "update" ? makeUser({ employeeId: "654321" }) : null);
      repo.findByEmployeeId.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser({ keycloakId: "race-winner" }));
      repo[operation].mockRejectedValueOnce({ code: "P2002" });

      expect(await userService.syncFromKeycloak(profile)).toMatchObject({ success: false, code: EMPLOYEE_ID_ALREADY_LINKED });
      expect(mockLogService.log).not.toHaveBeenCalled();
      expect(mockRoleRepo.findByCode).not.toHaveBeenCalled();
      expect(offSiteWorkEmployeeService.linkForUser).not.toHaveBeenCalled();
    });

    it.each([{ code: "P2002" }, new Error("Storage unavailable")])("does not mislabel unrelated database failures as employee conflicts", async (cause) => {
      repo.findByKeycloakId.mockResolvedValue(null);
      repo.create.mockRejectedValueOnce(cause);

      await expect(userService.syncFromKeycloak(profile)).rejects.toBe(cause);
    });

    it.each([null, makeUser({ departmentId: "keep-department" })])("continues without changing membership on an unresolved conflict", async (existing) => {
      repo.findByKeycloakId.mockResolvedValue(existing);
      repo.create.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(existing);
      mockRoleRepo.findByCode.mockResolvedValue(null);
      const result = await userService.syncFromKeycloak({ ...profile, department: "conflicting name", departmentShort: "conflicting abbreviation" });
      expect(result.success).toBe(true);
      if (existing) {
        expect(repo.update).toHaveBeenCalledWith(existing.id, expect.objectContaining({ departmentId: undefined }));
      } else {
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ departmentId: undefined }));
      }
    });

    it("does not create a user after a department storage failure", async () => {
      mockDeptService.resolveFromKeycloak.mockResolvedValue({ success: false, error: "unavailable", code: "DEPARTMENT_SYNC_FAILED" });
      expect(await userService.syncFromKeycloak(profile)).toMatchObject({ success: false });
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("creates new user and assigns default employee role", async () => {
      repo.findByKeycloakId.mockResolvedValue(null);
      const created = makeUser();
      repo.create.mockResolvedValue(created);
      mockLogService.log.mockResolvedValue({});
      mockRoleRepo.findByCode.mockResolvedValue({ id: "role-employee" });
      mockUserRoleRepo.assign.mockResolvedValue({});

      const result = await userService.syncFromKeycloak(profile);

      expect(result.success).toBe(true);
      expect(repo.create).toHaveBeenCalled();
      expect(mockRoleRepo.findByCode).toHaveBeenCalledWith("employee");
      expect(mockUserRoleRepo.assign).toHaveBeenCalledWith({
        userId: "u1",
        roleId: "role-employee",
      });
    });

    it("assigns super-admin role for employeeId 507733", async () => {
      repo.findByKeycloakId.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeUser({ employeeId: "507733" }));
      mockLogService.log.mockResolvedValue({});
      mockRoleRepo.findByCode.mockResolvedValue({ id: "role-super-admin" });
      mockUserRoleRepo.assign.mockResolvedValue({});

      await userService.syncFromKeycloak({ ...profile, employeeId: "507733" });

      expect(mockRoleRepo.findByCode).toHaveBeenCalledWith("super-admin");
    });

    it("does not fail when role assignment fails", async () => {
      repo.findByKeycloakId.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeUser());
      mockLogService.log.mockResolvedValue({});
      mockRoleRepo.findByCode.mockRejectedValue(new Error("db error"));

      const result = await userService.syncFromKeycloak(profile);

      expect(result.success).toBe(true);
    });

    it("updates existing user without assigning role", async () => {
      repo.findByKeycloakId.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(makeUser({ firstName: "Updated" }));

      const result = await userService.syncFromKeycloak(profile);

      expect(result.success).toBe(true);
      expect(repo.update).toHaveBeenCalled();
      expect(mockRoleRepo.findByCode).not.toHaveBeenCalled();
    });

    it("finds or creates department when provided", async () => {
      repo.findByKeycloakId.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeUser());
      mockLogService.log.mockResolvedValue({});
      mockRoleRepo.findByCode.mockResolvedValue(null);
      mockDeptService.resolveFromKeycloak.mockResolvedValue({ success: true, data: { id: "dept1" } });

      await userService.syncFromKeycloak({ ...profile, department: "IT", departmentShort: "IT" });

      expect(mockDeptService.resolveFromKeycloak).toHaveBeenCalledWith({ name: "IT", shortName: "IT" }, "keycloak-sync");
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ departmentId: "dept1" }));
    });
  });

  describe("handleLogin", () => {
    it("updates last login for active user", async () => {
      const user = makeUser({ status: "ACTIVE" });
      repo.findByKeycloakId.mockResolvedValue(user);
      repo.updateLastLogin.mockResolvedValue(user);
      mockLogService.log.mockResolvedValue({});

      const result = await userService.handleLogin("kc1");

      expect(result.success).toBe(true);
      expect(repo.updateLastLogin).toHaveBeenCalledWith("u1");
    });

    it("rejects inactive user", async () => {
      repo.findByKeycloakId.mockResolvedValue(makeUser({ status: "INACTIVE" }));
      mockLogService.log.mockResolvedValue({});

      const result = await userService.handleLogin("kc1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("USER_INACTIVE");
    });

    it("returns error when user not found", async () => {
      repo.findByKeycloakId.mockResolvedValue(null);

      const result = await userService.handleLogin("missing");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("USER_NOT_FOUND");
    });
  });

  describe("handleLogout", () => {
    it("logs logout and returns success", async () => {
      mockLogService.log.mockResolvedValue({});

      const result = await userService.handleLogout("u1");

      expect(result.success).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: "LOGOUT" })
      );
    });
  });

  describe("changeStatus", () => {
    it("changes status successfully", async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(makeUser({ status: "SUSPENDED" }));
      mockLogService.log.mockResolvedValue({});

      const result = await userService.changeStatus("u1", "SUSPENDED" as any, "actor1");

      expect(result.success).toBe(true);
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await userService.changeStatus("missing", "ACTIVE" as any, "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("USER_NOT_FOUND");
    });
  });

  describe("softDelete", () => {
    it("delegates to changeStatus with INACTIVE", async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(makeUser({ status: "INACTIVE" }));
      mockLogService.log.mockResolvedValue({});

      const result = await userService.softDelete("u1", "actor1");

      expect(result.success).toBe(true);
      expect(repo.update).toHaveBeenCalledWith("u1", { status: "INACTIVE" });
    });
  });

  describe("hardDelete", () => {
    it("deletes user and logs", async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.delete.mockResolvedValue({});
      mockLogService.log.mockResolvedValue({});

      const result = await userService.hardDelete("u1", "actor1");

      expect(result.success).toBe(true);
      expect(repo.delete).toHaveBeenCalledWith("u1");
    });

    it("returns error when not found", async () => {
      repo.findById.mockResolvedValue(null);

      const result = await userService.hardDelete("missing", "actor1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("USER_NOT_FOUND");
    });
  });
});
