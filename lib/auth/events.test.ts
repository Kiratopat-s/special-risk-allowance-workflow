import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/domains/user/service", () => ({ userService: { syncFromKeycloak: vi.fn(), handleLogin: vi.fn() } }));
vi.mock("@/lib/domains/user/repository", () => ({ userRepository: {} }));
vi.mock("@/lib/domains/action-log/service", () => ({ actionLogService: {} }));

import { userService } from "@/lib/domains/user/service";
import type { UserEntity } from "@/lib/domains/user/types";
import { EMPLOYEE_ID_ALREADY_LINKED, EMPLOYEE_ID_ALREADY_LINKED_MESSAGE } from "@/lib/domains/user/errors";
import { authEvents } from "./events";

const profile = { sub: "new-account", email: "new@example.test", given_name: "Test", family_name: "User", employee_id: "123456" };
const sync = vi.mocked(userService.syncFromKeycloak);
const login = vi.mocked(userService.handleLogin);
const user = { id: "db-1" } as UserEntity;

beforeEach(() => { sync.mockReset(); login.mockReset(); });

it("preserves the employee conflict and never records a successful login", async () => {
  const conflict = { success: false as const, code: EMPLOYEE_ID_ALREADY_LINKED, error: EMPLOYEE_ID_ALREADY_LINKED_MESSAGE };
  sync.mockResolvedValue(conflict);

  expect(await authEvents.onSignIn(profile)).toEqual(conflict);
  expect(login).not.toHaveBeenCalled();
});

it("returns the synced database identity only after login succeeds", async () => {
  sync.mockResolvedValue({ success: true, data: user });
  login.mockResolvedValue({ success: true, data: user });

  expect(await authEvents.onSignIn(profile)).toEqual({ success: true, data: { userId: "db-1" } });
});

it("denies a login rejected by the user service", async () => {
  sync.mockResolvedValue({ success: true, data: user });
  login.mockResolvedValue({ success: false, code: "USER_INACTIVE", error: "Inactive user" });

  expect(await authEvents.onSignIn(profile)).toMatchObject({ success: false, code: "USER_INACTIVE" });
});

it("fails closed when synchronization throws", async () => {
  sync.mockRejectedValue(new Error("Storage unavailable"));
  expect(await authEvents.onSignIn(profile)).toMatchObject({ success: false, code: "USER_SYNC_FAILED" });
  expect(login).not.toHaveBeenCalled();
});

it("denies an incomplete Keycloak profile before synchronization", async () => {
  expect(await authEvents.onSignIn({ sub: "new-account" })).toMatchObject({ success: false, code: "INVALID_PROFILE" });
  expect(sync).not.toHaveBeenCalled();
});
