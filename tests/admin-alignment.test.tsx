// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";
import { workflowTheme } from "@/components/workflow-ui/theme";
import { alignmentDepartments, alignmentPermissions, alignmentRoles, alignmentUsers } from "./fixtures/ui-alignment";

const mock = vi.hoisted(() => ({
  getRole: vi.fn(), save: vi.fn(), assign: vi.fn(), revoke: vi.fn(),
  query: new URLSearchParams(), path: "/admin/roles",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => mock.query,
  usePathname: () => mock.path,
}));
vi.mock("@/app/actions/permissions", () => ({
  getRole: mock.getRole,
  setRolePermissions: mock.save,
  createRole: vi.fn(),
  assignRoleToUser: mock.assign,
  revokeRoleFromUser: mock.revoke,
  listUsersWithRoles: vi.fn(),
}));
vi.mock("@/app/actions/department", () => ({
  createDepartment: vi.fn(), updateDepartment: vi.fn(), deleteDepartment: vi.fn(),
  toggleDepartmentStatus: vi.fn(), listAllDepartments: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { RolesClient } from "@/app/admin/roles/roles-client";
import { UsersClient } from "@/app/admin/users/users-client";
import { DepartmentsClient } from "@/app/admin/departments/departments-client";
import { PermissionsClient } from "@/app/admin/permissions/permissions-client";

function mount(children: ReactNode) {
  return render(<ThemeProvider theme={workflowTheme}>{children}</ThemeProvider>);
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.clearAllMocks();
  mock.query = new URLSearchParams();
  mock.path = "/admin/roles";
  mock.getRole.mockResolvedValue({ success: true, data: { ...alignmentRoles[0], permissions: [alignmentPermissions[0]] } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps permission IDs and selections through label clicks, keyboard input, pending saves, and failure", async () => {
  let finish!: (value: { success: false; error: string }) => void;
  mock.save.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const { container } = mount(<RolesClient initialRoles={alignmentRoles} allPermissions={alignmentPermissions} />);
  await userEvent.click(screen.getByRole("button", { name: new RegExp(alignmentRoles[0].name) }));
  const read = await screen.findByRole("checkbox", { name: /Read Department Expense Claims/ });
  expect((read as HTMLInputElement).checked).toBe(true);
  expect(container.querySelector("label label")).toBeNull();
  await userEvent.click(screen.getByText("List Department Expense Claims"));
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
  await userEvent.keyboard(" ");
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
  await userEvent.keyboard(" ");
  await userEvent.click(screen.getByRole("button", { name: "Save Permissions" }));
  await waitFor(() => expect(mock.save).toHaveBeenCalledExactlyOnceWith("role-fixture", ["permission-read", "permission-list"]));
  expect(screen.getAllByRole("checkbox").every((e) => (e as HTMLInputElement).disabled)).toBe(true);
  await userEvent.click(screen.getByText("List Department Expense Claims"));
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
  await act(async () => finish({ success: false, error: "fixture failure" }));
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
  expect((read as HTMLInputElement).disabled).toBe(false);
});

it("preserves administration search URL parameters and resets the page", () => {
  mock.query = new URLSearchParams("page=4&department=department-fixture");
  mock.path = "/admin/users";
  const history = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  mount(<UsersClient initialUsers={alignmentUsers} allRoles={alignmentRoles} allDepartments={alignmentDepartments} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Search users..." }), { target: { value: "ผู้ใช้งาน" } });
  const url = new URL(history.mock.calls[0][2] as string, "https://fixture.test");
  expect(url.pathname).toBe("/admin/users");
  expect(url.searchParams.get("search")).toBe("ผู้ใช้งาน");
  expect(url.searchParams.get("department")).toBe("department-fixture");
  expect(url.searchParams.has("page")).toBe(false);
});

it("keeps long user names, multiple roles, and a named assignment action in the scrollable table", async () => {
  mount(<UsersClient initialUsers={alignmentUsers} allRoles={alignmentRoles} allDepartments={alignmentDepartments} />);
  const region = screen.getByRole("region", { name: "Users" });
  expect(region.tabIndex).toBe(0);
  const assign = within(region).getByRole("button", { name: /^Assign role to/ });
  expect(within(region).getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
  await userEvent.click(assign);
  expect(screen.getByRole("dialog", { name: "Assign Role" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(assign);
  expect(mock.assign).not.toHaveBeenCalled();
  expect(mock.revoke).not.toHaveBeenCalled();
});

it("retains named department actions and editable values for long Thai names", async () => {
  mount(<DepartmentsClient initialDepartments={alignmentDepartments} />);
  const region = screen.getByRole("region", { name: "Departments" });
  const edit = within(region).getByRole("button", { name: "Edit " + alignmentDepartments[0].name });
  expect(within(region).getByRole("button", { name: "Delete " + alignmentDepartments[0].name })).toBeTruthy();
  await userEvent.click(edit);
  expect(screen.getByDisplayValue(alignmentDepartments[0].name)).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(edit);
});

it("keeps full permission names and codes available when groups expand", async () => {
  mount(<PermissionsClient permissions={alignmentPermissions} />);
  await userEvent.click(screen.getByRole("button", { name: "Expand all" }));
  for (const permission of alignmentPermissions) {
    expect(screen.getByText(permission.name)).toBeTruthy();
    expect(screen.getByText(permission.code)).toBeTruthy();
  }
});
