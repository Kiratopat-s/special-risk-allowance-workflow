import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("returns the module's build version without caching or consulting the database", async () => {
  vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_VERSION", "build-a");
  const { GET } = await import("@/app/api/version/route");
  vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_VERSION", "runtime-override");
  const response = GET();
  expect(await response.json()).toEqual({ version: "build-a" });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
