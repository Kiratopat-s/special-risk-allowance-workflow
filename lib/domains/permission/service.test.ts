vi.mock("./repository");

import {
  permissionRepository,
  roleRepository,
  userRoleRepository,
} from "./repository";
import { permissionService, roleService, authorizationService } from "./service";

const permRepo = permissionRepository as unknown as {
  findById: vi.Mock;
  findByCode: vi.Mock;
  findAll: vi.Mock;
  findByResource: vi.Mock;
  create: vi.Mock;
  update: vi.Mock;
  deactivate: vi.Mock;
  delete: vi.Mock;
  createMany: vi.Mock;
};

const rRepo = roleRepository as unknown as {
  findById: vi.Mock;
  findByCode: vi.Mock;
  findWithPermissions: vi.Mock;
  findByCodeWithPermissions: vi.Mock;
  findAll: vi.Mock;
  create: vi.Mock;
  update: vi.Mock;
  deactivate: vi.Mock;
  delete: vi.Mock;
  grantPermission: vi.Mock;
  revokePermission: vi.Mock;
  getPermissions: vi.Mock;
  setPermissions: vi.Mock;
};

const urRepo = userRoleRepository as unknown as {
  assign: vi.Mock;
  revoke: vi.Mock;
  getUserRoles: vi.Mock;
  hasRole: vi.Mock;
  hasPermission: vi.Mock;
  getAllUserPermissions: vi.Mock;
};

describe("permissionService", () => {
  describe("create", () => {
    it("creates permission when code is unique", async () => {
      permRepo.findByCode.mockResolvedValue(null);
      permRepo.create.mockResolvedValue({ id: "p1", code: "user:read" });

      const result = await permissionService.create({
        code: "user:read",
        resource: "USER" as any,
        action: "READ" as any,
        scope: "ALL" as any,
        description: "Read users",
      });

      expect(result.success).toBe(true);
    });

    it("rejects duplicate code", async () => {
      permRepo.findByCode.mockResolvedValue({ id: "existing" });

      const result = await permissionService.create({
        code: "user:read",
        resource: "USER" as any,
        action: "READ" as any,
        scope: "ALL" as any,
        description: "Read users",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("PERMISSION_CODE_EXISTS");
    });
  });

  describe("update", () => {
    it("rejects deactivating system permission", async () => {
      permRepo.findById.mockResolvedValue({ id: "p1", isSystem: true });

      const result = await permissionService.update("p1", { isActive: false });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("SYSTEM_PERMISSION");
    });

    it("updates non-system permission", async () => {
      permRepo.findById.mockResolvedValue({ id: "p1", isSystem: false });
      permRepo.update.mockResolvedValue({ id: "p1", description: "Updated" });

      const result = await permissionService.update("p1", { description: "Updated" });

      expect(result.success).toBe(true);
    });

    it("returns error when not found", async () => {
      permRepo.findById.mockResolvedValue(null);

      const result = await permissionService.update("missing", {});

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("PERMISSION_NOT_FOUND");
    });
  });

  describe("delete", () => {
    it("rejects deleting system permission", async () => {
      permRepo.findById.mockResolvedValue({ id: "p1", isSystem: true });

      const result = await permissionService.delete("p1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("SYSTEM_PERMISSION");
    });

    it("deletes non-system permission", async () => {
      permRepo.findById.mockResolvedValue({ id: "p1", isSystem: false });
      permRepo.delete.mockResolvedValue({});

      const result = await permissionService.delete("p1");

      expect(result.success).toBe(true);
    });
  });
});

describe("roleService", () => {
  describe("create", () => {
    it("creates role when code is unique", async () => {
      rRepo.findByCode.mockResolvedValue(null);
      rRepo.create.mockResolvedValue({ id: "r1", code: "admin" });

      const result = await roleService.create({
        code: "admin",
        name: "Admin",
        description: "Admin role",
      });

      expect(result.success).toBe(true);
    });

    it("rejects duplicate code", async () => {
      rRepo.findByCode.mockResolvedValue({ id: "existing" });

      const result = await roleService.create({
        code: "admin",
        name: "Admin",
        description: "Admin role",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("ROLE_CODE_EXISTS");
    });

    it("rejects when parent role not found", async () => {
      rRepo.findByCode.mockResolvedValue(null);
      rRepo.findById.mockResolvedValue(null);

      const result = await roleService.create({
        code: "sub",
        name: "Sub",
        description: "Sub role",
        parentRoleId: "missing",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("PARENT_ROLE_NOT_FOUND");
    });
  });

  describe("update", () => {
    it("rejects deactivating system role", async () => {
      rRepo.findById.mockResolvedValue({ id: "r1", isSystem: true });

      const result = await roleService.update("r1", { isActive: false });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("SYSTEM_ROLE");
    });

    it("rejects self-referencing parent", async () => {
      rRepo.findById.mockResolvedValue({ id: "r1", isSystem: false });

      const result = await roleService.update("r1", { parentRoleId: "r1" });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INVALID_PARENT_ROLE");
    });
  });

  describe("delete", () => {
    it("rejects deleting system role", async () => {
      rRepo.findById.mockResolvedValue({ id: "r1", isSystem: true });

      const result = await roleService.delete("r1");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("SYSTEM_ROLE");
    });

    it("deletes non-system role", async () => {
      rRepo.findById.mockResolvedValue({ id: "r1", isSystem: false });
      rRepo.delete.mockResolvedValue({});

      const result = await roleService.delete("r1");

      expect(result.success).toBe(true);
    });
  });

  describe("grantPermission", () => {
    it("rejects when role not found", async () => {
      rRepo.findById.mockResolvedValue(null);

      const result = await roleService.grantPermission({
        roleId: "missing",
        permissionId: "p1",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("ROLE_NOT_FOUND");
    });

    it("rejects when permission not found", async () => {
      rRepo.findById.mockResolvedValue({ id: "r1" });
      permRepo.findById.mockResolvedValue(null);

      const result = await roleService.grantPermission({
        roleId: "r1",
        permissionId: "missing",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("PERMISSION_NOT_FOUND");
    });
  });

  describe("setPermissions", () => {
    it("rejects when role not found", async () => {
      rRepo.findById.mockResolvedValue(null);

      const result = await roleService.setPermissions("missing", ["p1"]);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("ROLE_NOT_FOUND");
    });
  });
});

describe("authorizationService", () => {
  describe("assignRole", () => {
    it("assigns active role", async () => {
      rRepo.findById.mockResolvedValue({ id: "r1", isActive: true });
      urRepo.assign.mockResolvedValue({});

      const result = await authorizationService.assignRole({
        userId: "u1",
        roleId: "r1",
      });

      expect(result.success).toBe(true);
    });

    it("rejects inactive role", async () => {
      rRepo.findById.mockResolvedValue({ id: "r1", isActive: false });

      const result = await authorizationService.assignRole({
        userId: "u1",
        roleId: "r1",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INACTIVE_ROLE");
    });

    it("rejects when role not found", async () => {
      rRepo.findById.mockResolvedValue(null);

      const result = await authorizationService.assignRole({
        userId: "u1",
        roleId: "missing",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("ROLE_NOT_FOUND");
    });
  });

  describe("checkPermission", () => {
    it("allows with exact match and ALL scope", async () => {
      urRepo.getAllUserPermissions.mockResolvedValue([
        { resource: "USER", action: "READ", scope: "ALL" },
      ]);

      const result = await authorizationService.checkPermission({
        userId: "u1",
        resource: "USER" as any,
        action: "READ" as any,
      });

      expect(result.allowed).toBe(true);
      expect(result.effectiveScope).toBe("ALL");
    });

    it("denies when no matching permission", async () => {
      urRepo.getAllUserPermissions.mockResolvedValue([]);

      const result = await authorizationService.checkPermission({
        userId: "u1",
        resource: "USER" as any,
        action: "DELETE" as any,
      });

      expect(result.allowed).toBe(false);
    });

    it("allows via MANAGE escalation", async () => {
      urRepo.getAllUserPermissions.mockResolvedValue([
        { resource: "USER", action: "MANAGE", scope: "ALL" },
      ]);

      const result = await authorizationService.checkPermission({
        userId: "u1",
        resource: "USER" as any,
        action: "DELETE" as any,
      });

      expect(result.allowed).toBe(true);
    });

    it("denies OWN scope when accessing other's resource", async () => {
      urRepo.getAllUserPermissions.mockResolvedValue([
        { resource: "USER", action: "READ", scope: "OWN" },
      ]);

      const result = await authorizationService.checkPermission({
        userId: "u1",
        resource: "USER" as any,
        action: "READ" as any,
        targetOwnerId: "u2",
      });

      expect(result.allowed).toBe(false);
    });

    it("allows OWN scope when accessing own resource", async () => {
      urRepo.getAllUserPermissions.mockResolvedValue([
        { resource: "USER", action: "READ", scope: "OWN" },
      ]);

      const result = await authorizationService.checkPermission({
        userId: "u1",
        resource: "USER" as any,
        action: "READ" as any,
        targetOwnerId: "u1",
      });

      expect(result.allowed).toBe(true);
    });

    it("picks broadest scope when multiple matches", async () => {
      urRepo.getAllUserPermissions.mockResolvedValue([
        { resource: "USER", action: "READ", scope: "OWN" },
        { resource: "USER", action: "READ", scope: "ALL" },
      ]);

      const result = await authorizationService.checkPermission({
        userId: "u1",
        resource: "USER" as any,
        action: "READ" as any,
      });

      expect(result.allowed).toBe(true);
      expect(result.effectiveScope).toBe("ALL");
    });
  });

  describe("getEffectivePermissions", () => {
    it("deduplicates permissions across roles", async () => {
      const sharedPerm = { id: "p1", resource: "USER", action: "READ" };
      urRepo.getUserRoles.mockResolvedValue([
        {
          role: { id: "r1", name: "Role1", permissions: [sharedPerm] },
          departmentId: null,
        },
        {
          role: { id: "r2", name: "Role2", permissions: [sharedPerm] },
          departmentId: null,
        },
      ]);

      const result = await authorizationService.getEffectivePermissions("u1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissions).toHaveLength(1);
        expect(result.data.roles).toHaveLength(2);
      }
    });
  });
});
