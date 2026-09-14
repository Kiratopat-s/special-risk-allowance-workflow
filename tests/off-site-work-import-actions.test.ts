import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), can: vi.fn(), match: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("@/lib/auth/permissions", () => ({ can: mock.can }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/domains/off-site-work", () => ({ offSiteWorkService: {} }));
vi.mock("@/lib/domains/off-site-work/employee-service", () => ({ offSiteWorkEmployeeService: { match: mock.match } }));
import { matchOffSiteWorkEmployees } from "@/app/actions/off-site-work";

beforeEach(() => { vi.resetAllMocks(); });
describe("PDF employee matching action", () => {
  it("requires authentication and create or update permission before querying employee data", async () => {
    mock.auth.mockResolvedValue(null);
    expect(await matchOffSiteWorkEmployees(["100001"])).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    mock.auth.mockResolvedValue({ user: { dbUserId: "actor" } });
    mock.can.mockResolvedValue(false);
    expect(await matchOffSiteWorkEmployees(["100001"])).toMatchObject({ success: false, code: "PERMISSION_DENIED" });
    expect(mock.match).not.toHaveBeenCalled();
  });
  it("allows an editor without create permission to match accounts", async () => {
    mock.auth.mockResolvedValue({ user: { dbUserId: "editor" } });
    mock.can.mockImplementation(async (_user, _resource, action) => action === "UPDATE");
    mock.match.mockResolvedValue({ success: true, data: [] });
    expect(await matchOffSiteWorkEmployees(["000001"])).toEqual({ success: true, data: [] });
    expect(mock.can).toHaveBeenCalledWith("editor", "OFF_SITE_WORK", "UPDATE");
    expect(mock.match).toHaveBeenCalledWith(["000001"]);
  });
  it("passes only employee codes to the domain service", async () => {
    mock.auth.mockResolvedValue({ user: { dbUserId: "actor" } });
    mock.can.mockResolvedValue(true);
    mock.match.mockResolvedValue({ success: true, data: [] });
    expect(await matchOffSiteWorkEmployees(["100001"])).toEqual({ success: true, data: [] });
    expect(mock.can).toHaveBeenCalledWith("actor", "OFF_SITE_WORK", "CREATE");
    expect(mock.match).toHaveBeenCalledWith(["100001"]);
  });
});
