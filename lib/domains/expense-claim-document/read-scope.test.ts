import { beforeEach, describe, it, expect, vi } from "vitest";
import type { UserRoleWithDetails } from "@/lib/domains/permission/types";
import type { PermissionAction, PermissionScope } from "@/lib/shared/types";
const mock = vi.hoisted(() => ({ roles: vi.fn(), user: vi.fn(), claim: vi.fn() }));
vi.mock("@/lib/domains/permission/service", () => ({ authorizationService: { getUserRoles: mock.roles } }));
vi.mock("./read-repository", () => ({ claimReadRepository: { findUserDepartment: mock.user, findClaimTarget: mock.claim } }));
import { canReadClaimInScope, requireReadableClaim, resolveAnalyticsClaimScope, resolveClaimDetailScope, resolveClaimReadScope } from "./read-scope";

function role(action: PermissionAction, scope: PermissionScope, departmentId: string | null = null): UserRoleWithDetails {
  return {
    isActive: true, expiresAt: null, departmentId,
    role: { isActive: true, parentRoleId: null, permissions: [{ resource: "EXPENSE_CLAIM", action, scope, isActive: true }] },
  } as UserRoleWithDetails;
}
function roles(...assignments: UserRoleWithDetails[]) {
  mock.roles.mockResolvedValue({ success: true, data: assignments });
}
beforeEach(() => {
  vi.resetAllMocks();
  roles();
  mock.user.mockResolvedValue({ departmentId: "home" });
  mock.claim.mockResolvedValue({ id: "claim", userId: "other", status: "DRAFT", claimant: { departmentId: "home" } });
});

describe("shared claim visibility", () => {
  it("allows unbound ALL and constrains OWN without sentinel-owner checks", async () => {
    roles(role("LIST", "ALL"));
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: true, data: { scope: "ALL", where: {} } });
    roles(role("LIST", "OWN"));
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: true, data: { scope: "OWN", where: { userId: "me" } } });
  });
  it("preserves own-only READ fallback even if READ is broad", async () => {
    roles(role("READ", "ALL"));
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: true, data: { scope: "OWN", where: { userId: "me" } } });
    expect(await resolveClaimDetailScope("me")).toMatchObject({ success: true, data: { scope: "ALL" } });
  });
  it("uses the home department for an unbound department grant", async () => {
    roles(role("LIST", "DEPARTMENT"));
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: true, data: {
      scope: "DEPARTMENT", departmentIds: ["home"], where: { claimant: { departmentId: { in: ["home"] } } },
    } });
  });
  it.each(["ALL", "DEPARTMENT"] as const)("binds a %s permission to the role's assigned department", async (scope) => {
    roles(role("READ", scope, "assigned"));
    const result = await resolveClaimDetailScope("me");
    expect(result).toMatchObject({ success: true, data: { scope: "DEPARTMENT", departmentIds: ["assigned"] } });
    if (!result.success) throw new Error("scope denied");
    expect(canReadClaimInScope(result.data, { userId: "other", claimant: { departmentId: "assigned" } })).toBe(true);
    expect(canReadClaimInScope(result.data, { userId: "other", claimant: { departmentId: "home" } })).toBe(false);
    expect(canReadClaimInScope(result.data, { userId: "other", claimant: { departmentId: "assigned-child" } })).toBe(false);
  });
  it("combines own and explicitly assigned department grants without dropping either", async () => {
    roles(role("LIST", "OWN"), role("LIST", "DEPARTMENT", "assigned"));
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: true, data: {
      scope: "DEPARTMENT", includeOwn: true, where: { OR: [{ userId: "me" }, { claimant: { departmentId: { in: ["assigned"] } } }] },
    } });
  });
  it("keeps exact action permissions ahead of broader MANAGE", async () => {
    roles(role("READ", "OWN"), role("MANAGE", "ALL"));
    expect(await resolveClaimDetailScope("me")).toMatchObject({ success: true, data: { scope: "OWN" } });
  });
  it("uses MANAGE as fallback when no exact action exists", async () => {
    roles(role("MANAGE", "ALL"));
    expect(await resolveClaimDetailScope("me")).toMatchObject({ success: true, data: { scope: "ALL" } });
  });
  it.each(["assignment", "role", "permission", "expired"])("ignores %s grants that are no longer active", async (kind) => {
    const assignment = role("LIST", "ALL");
    if (kind === "assignment") assignment.isActive = false;
    if (kind === "role") assignment.role.isActive = false;
    if (kind === "permission") assignment.role.permissions[0].isActive = false;
    if (kind === "expired") assignment.expiresAt = new Date(0);
    roles(assignment);
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
  });
  it("does not invent inherited grants from a parent role reference", async () => {
    const assignment = role("CREATE", "ALL");
    assignment.role.parentRoleId = "parent-with-read";
    roles(assignment);
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
  });
  it("fails closed for missing departments, missing users and absent permissions", async () => {
    roles(role("READ", "DEPARTMENT"));
    mock.user.mockResolvedValue({ departmentId: null });
    expect(await resolveClaimDetailScope("me")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
    mock.user.mockResolvedValue(null);
    expect(await resolveClaimDetailScope("me")).toMatchObject({ success: false });
    mock.user.mockResolvedValue({ departmentId: "home" });
    roles();
    expect(await resolveClaimReadScope("me")).toMatchObject({ success: false });
  });
  it("intersects LIST and READ scopes for analytics instead of broadening detail access", async () => {
    roles(role("LIST", "ALL"), role("READ", "OWN"));
    expect(await resolveAnalyticsClaimScope("me")).toEqual({ success: true, data: { scope: "OWN", where: { AND: [{}, { userId: "me" }] } } });
    roles(role("LIST", "ALL"));
    expect(await resolveAnalyticsClaimScope("me")).toMatchObject({ success: false });
  });
});

describe("direct-ID claim READ guard", () => {
  it("blocks forged other-department IDs before loading sensitive document data", async () => {
    roles(role("READ", "DEPARTMENT", "assigned"));
    expect(await requireReadableClaim("claim", "me")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
    expect(mock.claim).toHaveBeenCalledWith("claim");
  });
  it("allows department reads and returns only the access target", async () => {
    roles(role("READ", "DEPARTMENT"));
    expect(await requireReadableClaim("claim", "me")).toMatchObject({ success: true, data: { id: "claim", userId: "other" } });
  });
  it("does not query a claim when the caller has no READ permission", async () => {
    expect(await requireReadableClaim("claim", "me")).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
    expect(mock.claim).not.toHaveBeenCalled();
  });
  it("reports a missing claim for an authorized reader", async () => {
    roles(role("READ", "ALL"));
    mock.claim.mockResolvedValue(null);
    expect(await requireReadableClaim("missing", "me")).toMatchObject({ success: false, code: "CLAIM_NOT_FOUND" });
  });
});
