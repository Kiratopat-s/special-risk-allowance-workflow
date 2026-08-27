vi.mock("./repository");
vi.mock("@/lib/domains/action-log/service");
vi.mock("@/lib/domains/department/repository");
vi.mock("@/lib/domains/permission/repository");

import { userRepository } from "./repository";
import { actionLogService } from "@/lib/domains/action-log/service";
import { departmentRepository } from "@/lib/domains/department/repository";
import { userRoleRepository, roleRepository } from "@/lib/domains/permission/repository";
import { userService } from "./service";

const repo = userRepository as unknown as {
  findById: vi.Mock;
  findByKeycloakId: vi.Mock;
  create: vi.Mock;
  update: vi.Mock;
  updateLastLogin: vi.Mock;
  delete: vi.Mock;
  findMany: vi.Mock;
};

const mockLogService = actionLogService as unknown as { log: vi.Mock };
const mockDeptRepo = departmentRepository as unknown as { findOrCreateByName: vi.Mock };
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
      mockDeptRepo.findOrCreateByName.mockResolvedValue({ id: "dept1" });

      await userService.syncFromKeycloak({ ...profile, department: "IT", departmentShort: "IT" });

      expect(mockDeptRepo.findOrCreateByName).toHaveBeenCalledWith("IT", "IT");
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
