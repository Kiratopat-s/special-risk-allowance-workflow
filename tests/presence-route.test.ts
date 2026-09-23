import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { decode, encode } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

const mocks = vi.hoisted(() => ({
  heartbeat: vi.fn(),
  onProfileSync: vi.fn(),
  onSessionRefresh: vi.fn(),
}));
vi.mock("@/lib/domains/presence", () => ({ presenceService: { heartbeat: mocks.heartbeat } }));
vi.mock("@/lib/auth/events", () => ({ authEvents: {
  onProfileSync: mocks.onProfileSync,
  onSessionRefresh: mocks.onSessionRefresh,
} }));

const origin = "https://sraw.example.test";
const cookieName = "__Secure-authjs.session-token";
const secret = "presence-route-tests-only-secret-at-least-32-characters";
const snapshot = { count: 4, measuredAt: "2026-09-23T09:00:00.000Z" };

async function request(options: { token?: JWT | null; headers?: Record<string, string>; body?: string } = {}) {
  const headers = new Headers({ Origin: origin, ...options.headers });
  if (options.token !== null) {
    const token = await encode({
      token: options.token ?? { sub: "kc-a", dbUserId: "user-a", expiresAt: Math.floor(Date.now() / 1_000) + 3_600 },
      secret,
      salt: cookieName,
    });
    headers.set("Cookie", `${cookieName}=${token}`);
  }
  return new NextRequest(`${origin}/api/presence`, { method: "POST", headers, body: options.body });
}

async function call(req: NextRequest) {
  const { POST } = await import("@/app/api/presence/route");
  return POST(req);
}

describe("POST /api/presence with the real Auth.js wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("AUTH_SECRET", secret);
    vi.stubEnv("AUTH_URL", origin);
    vi.stubEnv("NEXTAUTH_URL", origin);
    vi.stubEnv("AUTH_KEYCLOAK_ID", "test-client");
    vi.stubEnv("AUTH_KEYCLOAK_SECRET", "test-client-secret");
    vi.stubEnv("AUTH_KEYCLOAK_ISSUER", "https://keycloak.example.test/realms/test");
    mocks.heartbeat.mockResolvedValue({ success: true, data: snapshot });
    mocks.onProfileSync.mockResolvedValue({ updated: false });
    mocks.onSessionRefresh.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns an uncached aggregate using only the signed session identity", async () => {
    const response = await call(await request({ body: JSON.stringify({ userId: "attacker", lastSeenAt: "2099-01-01" }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: snapshot });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.heartbeat).toHaveBeenCalledExactlyOnceWith("user-a");
    expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith(`${cookieName}=`))).toBe(true);
  });

  it.each([
    { Origin: "https://attacker.example.test" },
    { Origin: "null" },
    { Origin: origin, "Sec-Fetch-Site": "cross-site" },
  ])("rejects an untrusted origin before updating presence: %j", async (headers) => {
    const response = await call(await request({ headers }));
    expect(response.status).toBe(403);
    expect(mocks.heartbeat).not.toHaveBeenCalled();
  });

  it("rejects requests without an Origin header", async () => {
    const req = await request();
    req.headers.delete("Origin");
    const response = await call(req);
    expect(response.status).toBe(403);
    expect(mocks.heartbeat).not.toHaveBeenCalled();
  });

  it("accepts the canonical public origin when the reverse proxy forwards an internal URL", async () => {
    const original = await request();
    const proxied = new NextRequest("http://127.0.0.1:3000/api/presence", {
      method: "POST", headers: original.headers,
    });
    const response = await call(proxied);
    expect(response.status).toBe(200);
    expect(mocks.heartbeat).toHaveBeenCalledExactlyOnceWith("user-a");
  });

  it("rejects cross-origin traffic before refreshing an expired session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await call(await request({
      headers: { Origin: "https://attacker.example.test" },
      token: { sub: "kc-a", dbUserId: "user-a", refreshToken: "expired", expiresAt: 1 },
    }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.onProfileSync).not.toHaveBeenCalled();
    expect(mocks.heartbeat).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { sub: "kc-a", expiresAt: Math.floor(Date.now() / 1_000) + 3_600 },
    { sub: "kc-a", dbUserId: "user-a", error: "RefreshAccessTokenError", expiresAt: Math.floor(Date.now() / 1_000) + 3_600 },
  ])("returns JSON 401 without a redirect for an invalid session: %j", async (token) => {
    const response = await call(await request({ token }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" });
    expect(response.headers.get("Location")).toBeNull();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.heartbeat).not.toHaveBeenCalled();
  });

  it("persists a refreshed Keycloak JWT so subsequent heartbeats do not refresh again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      access_token: "refreshed-access-token",
      refresh_token: "rotated-refresh-token",
      expires_in: 3_600,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await call(await request({ token: {
      sub: "kc-a", keycloakId: "kc-a", dbUserId: "user-a",
      accessToken: "expired-access-token", refreshToken: "old-refresh-token", expiresAt: 1,
    } }));
    expect(response.status).toBe(200);
    const sessionCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${cookieName}=`));
    expect(sessionCookie).toBeDefined();
    const encoded = sessionCookie!.slice(cookieName.length + 1).split(";")[0];
    const refreshed = await decode({ token: encoded, secret, salt: cookieName });
    expect(refreshed).toMatchObject({ accessToken: "refreshed-access-token", refreshToken: "rotated-refresh-token", dbUserId: "user-a" });
    const req = new NextRequest(`${origin}/api/presence`, {
      method: "POST", headers: { Origin: origin, Cookie: `${cookieName}=${encoded}` },
    });
    expect((await call(req)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns JSON 401 and persists the token error when Keycloak refresh fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid_grant" }, { status: 400 })));
    const response = await call(await request({ token: {
      sub: "kc-a", dbUserId: "user-a", refreshToken: "revoked-refresh-token", expiresAt: 1,
    } }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(response.headers.get("Location")).toBeNull();
    expect(mocks.heartbeat).not.toHaveBeenCalled();
    const sessionCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${cookieName}=`));
    expect(sessionCookie).toBeDefined();
    const token = await decode({ token: sessionCookie!.slice(cookieName.length + 1).split(";")[0], secret, salt: cookieName });
    expect(token?.error).toBe("RefreshAccessTokenError");
    expect(token?.refreshToken).toBeUndefined();
  });

  it("reports temporary storage failures without exposing internal errors or a false zero", async () => {
    mocks.heartbeat.mockResolvedValue({ success: false, error: "Internal details", code: "PRESENCE_UNAVAILABLE" });
    const response = await call(await request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: "Presence unavailable", code: "PRESENCE_UNAVAILABLE" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
