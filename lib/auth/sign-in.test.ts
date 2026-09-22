import { beforeEach, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";
import { EMPLOYEE_ID_ALREADY_LINKED } from "@/lib/domains/user/errors";

const captured = vi.hoisted(() => ({ config: null as NextAuthConfig | null, sync: vi.fn() }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => {
  captured.config = config;
  return {};
} }));
vi.mock("@/lib/auth/events", () => ({ authEvents: { onSignIn: captured.sync } }));
await import("@/lib/auth");
const callbacks = captured.config!.callbacks!;
const profile = { sub: "kc-1", email: "test@example.test", given_name: "Test", family_name: "User" };
const account = { provider: "keycloak", access_token: "test-only", expires_at: Math.floor(Date.now() / 1000) + 3600 };

beforeEach(() => { captured.sync.mockReset(); });

it("syncs once before issuing a JWT and passes the database identity through", async () => {
  captured.sync.mockResolvedValue({ success: true, data: { userId: "db-1" } });
  const user = { id: "kc-1" };
  expect(await callbacks.signIn!({ user, account, profile } as never)).toBe(true);
  const token = await callbacks.jwt!({ user, account, profile, token: { sub: "kc-1" } } as never);
  expect(token).toMatchObject({ dbUserId: "db-1", keycloakId: "kc-1" });
  expect(captured.sync).toHaveBeenCalledTimes(1);
  const session = await callbacks.session!({ session: { user: {} }, token } as never);
  expect(session.user).toMatchObject({ dbUserId: "db-1" });
});

it("denies sign-in when database synchronization failed", async () => {
  captured.sync.mockResolvedValue({ success: false, error: "Storage unavailable", code: "USER_SYNC_FAILED" });
  expect(await callbacks.signIn!({ user: {}, account, profile } as never)).toBe(false);
  expect(await callbacks.jwt!({ user: {}, account, profile, token: { dbUserId: "stale-id" } } as never)).toBeNull();
  expect(captured.config!.pages).toMatchObject({ error: "/auth/signin" });
});

it("redirects an employee ID conflict to its warning without issuing a database identity or JWT", async () => {
  captured.sync.mockResolvedValue({ success: false, error: "Already linked", code: EMPLOYEE_ID_ALREADY_LINKED });
  const user = { id: "kc-2" };
  expect(await callbacks.signIn!({ user, account, profile } as never))
    .toBe(`/auth/signin?error=${EMPLOYEE_ID_ALREADY_LINKED}`);
  expect(user).not.toHaveProperty("dbUserId");
  expect(await callbacks.jwt!({ user, account, profile, token: {} } as never)).toBeNull();
});

it("denies unexpected synchronization errors", async () => {
  captured.sync.mockRejectedValue(new Error("Storage unavailable"));
  expect(await callbacks.signIn!({ user: {}, account, profile } as never)).toBe(false);
});

it("denies missing profiles without invoking synchronization", async () => {
  expect(await callbacks.signIn!({ user: {}, account } as never)).toBe(false);
  expect(captured.sync).not.toHaveBeenCalled();
});

it("does not resync existing sessions during normal JWT reads", async () => {
  const token = { dbUserId: "db-1", expiresAt: Math.floor(Date.now() / 1000) + 3600 };
  expect(await callbacks.jwt!({ token } as never)).toEqual(token);
  expect(captured.sync).not.toHaveBeenCalled();
});
