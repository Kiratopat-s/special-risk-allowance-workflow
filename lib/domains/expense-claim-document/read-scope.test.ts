import { beforeEach, describe, it, expect, vi } from "vitest";
const { can } = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ can }));
import { resolveClaimReadScope } from "./read-scope";
describe("shared claim visibility", () => {
  beforeEach(() => can.mockReset());
  it("allows ALL only after the original LIST sentinel check", async () => {
    can.mockResolvedValue(true);
    expect(await resolveClaimReadScope("me")).toEqual({
      success: true,
      data: { scope: "ALL" },
    });
    expect(can).toHaveBeenLastCalledWith("me", "EXPENSE_CLAIM", "LIST", {
      targetOwnerId: "00000000-0000-0000-0000-000000000000",
    });
  });
  it("forces own records for LIST:OWN", async () => {
    can.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await resolveClaimReadScope("me")).toEqual({
      success: true,
      data: { scope: "OWN", userId: "me" },
    });
  });
  it("preserves own-only READ fallback even if READ is broad", async () => {
    can.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await resolveClaimReadScope("me")).toEqual({
      success: true,
      data: { scope: "OWN", userId: "me" },
    });
  });
  it("denies callers with neither LIST nor READ", async () => {
    can.mockResolvedValue(false);
    expect(await resolveClaimReadScope("me")).toMatchObject({
      success: false,
      code: "PERMISSION_DENIED",
    });
  });
});
