// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

const mocks = vi.hoisted(() => ({
  config: null as NextAuthConfig | null,
  session: null as Session | null,
  auth: vi.fn(),
  sync: vi.fn(),
  findUser: vi.fn(),
  log: vi.fn(),
  updateSession: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => {
  mocks.config = config;
  return { auth: mocks.auth };
} }));
vi.mock("next-auth/react", () => ({ useSession: () => ({
  data: mocks.session, status: "authenticated", update: mocks.updateSession,
}) }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth/events", () => ({ authEvents: {} }));
vi.mock("@/lib/domains/user/service", () => ({ userService: { syncFromKeycloak: mocks.sync } }));
vi.mock("@/lib/domains/user/repository", () => ({ userRepository: { findByKeycloakIdWithDepartment: mocks.findUser } }));
vi.mock("@/lib/domains/action-log/service", () => ({ actionLogService: { log: mocks.log } }));
vi.mock("sonner", () => ({ toast: { success: mocks.successToast, error: mocks.errorToast } }));

vi.stubEnv("AUTH_KEYCLOAK_ISSUER", "https://identity.example.test/realms/workflow");
vi.stubEnv("AUTH_KEYCLOAK_ID", "workflow-test");
vi.stubEnv("AUTH_KEYCLOAK_SECRET", "test-only-secret");
const { default: EditProfilePage } = await import("@/app/profile/edit/page");
const { default: ProfilePage } = await import("@/app/profile/page");
const callbacks = mocks.config!.callbacks!;

let token: JWT;
let fetchMock: ReturnType<typeof vi.fn>;

async function readSession() {
  return await callbacks.session!({
    session: { user: { name: "Old User" }, expires: "2099-01-01T00:00:00.000Z" },
    token,
  } as never) as Session;
}

beforeEach(async () => {
  token = {
    sub: "kc-1", keycloakId: "kc-1", dbUserId: "db-1", name: "Old User",
    firstName: "Old", lastName: "User", email: "user@example.test",
    peaEmail: "employee@example.test", employeeId: "123456", phoneNumber: "0123456789",
    position: "Engineer", positionShort: "Eng", positionLevel: "5",
    department: "Operations", departmentShort: "Ops",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
  mocks.session = await readSession();
  mocks.auth.mockImplementation(async () => mocks.session);
  mocks.updateSession.mockImplementation(async (session) => {
    token = await callbacks.jwt!({ token, trigger: "update", session } as never) as JWT;
    mocks.session = await readSession();
    return mocks.session;
  });
  mocks.findUser.mockResolvedValue(null);
  mocks.sync.mockResolvedValue({ success: true, data: { id: "db-1" } });
  fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ access_token: "test-admin-token" }))
    .mockResolvedValueOnce(Response.json({ attributes: {
      pea_email: ["employee@example.test"], employee_id: ["123456"], other: ["preserved"],
    } }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
afterAll(() => { vi.unstubAllEnvs(); });

it("shows a saved name on the profile immediately using the updated session", async () => {
  let finishSessionUpdate!: () => void;
  const sessionReady = new Promise<void>((resolve) => { finishSessionUpdate = resolve; });
  const updateSession = mocks.updateSession.getMockImplementation()!;
  mocks.updateSession.mockImplementationOnce(async (data) => {
    await sessionReady;
    return updateSession(data);
  });
  const user = userEvent.setup();
  const editor = render(<EditProfilePage />);
  await user.clear(screen.getByLabelText("First Name"));
  await user.type(screen.getByLabelText("First Name"), "New");
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(mocks.updateSession).toHaveBeenCalledOnce());
  expect(mocks.router.push).not.toHaveBeenCalled();
  expect(mocks.router.refresh).not.toHaveBeenCalled();
  await act(async () => { finishSessionUpdate(); });
  await waitFor(() => expect(mocks.router.refresh).toHaveBeenCalledOnce());
  expect(mocks.router.push).toHaveBeenCalledWith("/profile");
  expect(mocks.updateSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.router.push.mock.invocationCallOrder[0]);
  expect(mocks.session?.user).toMatchObject({ name: "New User", firstName: "New", keycloakId: "kc-1", dbUserId: "db-1" });
  const [url, request] = fetchMock.mock.calls[2];
  expect(url).toBe("https://identity.example.test/admin/realms/workflow/users/kc-1");
  expect(request.method).toBe("PUT");
  expect(JSON.parse(request.body)).toMatchObject({ firstName: "New", attributes: { other: ["preserved"] } });
  expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ firstName: "New" }), expect.anything());

  editor.unmount();
  render(await ProfilePage());
  expect(screen.getAllByText("New User")).toHaveLength(2);
  expect(screen.queryByText("Old User")).toBeNull();
});

it("clears optional profile values while preserving attributes retained in Keycloak", async () => {
  const user = userEvent.setup();
  const editor = render(<EditProfilePage />);
  for (const label of ["PEA Email", "Employee ID", "Phone Number", "Position", "Position (Short)", "Position Level", "Department", "Department (Short)"]) {
    await user.clear(screen.getByLabelText(label));
  }
  await user.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(mocks.router.refresh).toHaveBeenCalledOnce());
  const expected = {
    peaEmail: "employee@example.test", employeeId: "123456", phoneNumber: "",
    position: "", positionShort: "", positionLevel: "", department: "", departmentShort: "",
  };
  expect(mocks.session?.user).toMatchObject(expected);
  expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining(expected), expect.anything());
  editor.unmount();
  render(await ProfilePage());
  expect(screen.queryByText("0123456789")).toBeNull();
  expect(screen.queryByText("Engineer (Eng)")).toBeNull();
  expect(screen.getAllByText("Not provided")).toHaveLength(4);
  expect(screen.getByText("employee@example.test")).toBeTruthy();
});

it("keeps the existing session and form when Keycloak rejects the update", async () => {
  fetchMock.mockReset()
    .mockResolvedValueOnce(Response.json({ access_token: "test-admin-token" }))
    .mockResolvedValueOnce(Response.json({ attributes: {} }))
    .mockResolvedValueOnce(Response.json({ error: "Forbidden" }, { status: 403 }));
  render(<EditProfilePage />);
  await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledOnce());
  expect(mocks.updateSession).not.toHaveBeenCalled();
  expect(mocks.router.push).not.toHaveBeenCalled();
  expect(mocks.router.refresh).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.session?.user.name).toBe("Old User");
});

it("derives the name from refreshed name claims and falls back for sessions without them", async () => {
  token.firstName = "Latest";
  token.lastName = "Name";
  expect((await readSession()).user.name).toBe("Latest Name");
  delete token.firstName;
  delete token.lastName;
  expect((await readSession()).user.name).toBe("Old User");
});
