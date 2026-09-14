import { afterEach, beforeEach, expect, it, vi } from "vitest";

let client: typeof import("./client");
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_VERSION", "build-a");
  client = await import("./client");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("allows current actions, notices a new build, and never dispatches stale calls", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ version: "build-a" })).mockResolvedValueOnce(Response.json({ version: "build-b" }));
  vi.stubGlobal("fetch", fetcher);
  const action = vi.fn().mockResolvedValue({ success: true });
  const listener = vi.fn();
  const unsubscribe = client.subscribeToDeployment(listener);
  await client.checkDeploymentVersion();
  expect(await client.runServerAction(action)).toEqual({ success: true });
  await client.checkDeploymentVersion();
  expect(client.isDeploymentOutdated()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(await client.runServerAction(action)).toBeUndefined();
  await client.checkDeploymentVersion();
  expect(action).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenCalledWith("/api/version", expect.objectContaining({ cache: "no-store" }));
  unsubscribe();
});

it.each([
  () => Promise.reject(new Error("offline")),
  () => Promise.resolve(new Response("unavailable", { status: 503 })),
  () => Promise.resolve(new Response("not json")),
  () => Promise.resolve(Response.json({ version: "" })),
  () => Promise.resolve(Response.json({ unexpected: true })),
])("ignores temporary or invalid version responses", async (response) => {
  vi.stubGlobal("fetch", vi.fn(response));
  await client.checkDeploymentVersion();
  expect(client.isDeploymentOutdated()).toBe(false);
});

it("deduplicates checks and waits for a pending visibility check before dispatch", async () => {
  let respond!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const first = client.checkDeploymentVersion();
  const second = client.checkDeploymentVersion();
  const action = vi.fn();
  const call = client.runServerAction(action);
  respond(Response.json({ version: "build-b" }));
  await Promise.all([first, second, call]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(action).not.toHaveBeenCalled();
});

it("reports an unknown action immediately and never replays it", async () => {
  const error = new Error("Server Action is unavailable");
  error.name = "UnrecognizedActionError";
  const action = vi.fn().mockRejectedValue(error);
  expect(await client.runServerAction(action)).toBeUndefined();
  expect(client.isDeploymentOutdated()).toBe(true);
  await client.runServerAction(action);
  expect(action).toHaveBeenCalledTimes(1);
});

it("preserves ordinary errors", async () => {
  const error = new Error("permission denied");
  await expect(client.runServerAction(async () => { throw error; })).rejects.toBe(error);
  expect(client.isDeploymentOutdated()).toBe(false);
});
