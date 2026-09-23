import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repository", () => ({
  presenceRepository: { heartbeat: vi.fn(), getOnlineCount: vi.fn() },
}));

import { createPresenceService } from "./service";
import type { OnlineCountSnapshot } from "@/lib/presence/types";

const snapshot = { count: 3, measuredAt: "2026-09-23T09:00:00.000Z" };

function fixture() {
  let now = 0;
  const repository = {
    heartbeat: vi.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined),
    getOnlineCount: vi.fn<() => Promise<OnlineCountSnapshot>>().mockResolvedValue(snapshot),
  };
  return {
    repository,
    service: createPresenceService(repository, () => now),
    setNow: (value: number) => { now = value; },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("presenceService", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("finishes the user's heartbeat before querying a count", async () => {
    const { service, repository } = fixture();
    const write = deferred<void>();
    repository.heartbeat.mockReturnValueOnce(write.promise);
    const result = service.heartbeat("user-a");
    expect(repository.heartbeat).toHaveBeenCalledWith("user-a");
    expect(repository.getOnlineCount).not.toHaveBeenCalled();
    write.resolve(undefined);
    expect(await result).toEqual({ success: true, data: snapshot });
  });

  it("keeps writing heartbeats while sharing a global snapshot for ten seconds", async () => {
    const { service, repository, setNow } = fixture();
    await service.heartbeat("user-a");
    setNow(9_999);
    expect(await service.heartbeat("user-b")).toEqual({ success: true, data: snapshot });
    expect(repository.getOnlineCount).toHaveBeenCalledTimes(1);
    setNow(10_000);
    await service.heartbeat("user-c");
    expect(repository.heartbeat).toHaveBeenCalledTimes(3);
    expect(repository.getOnlineCount).toHaveBeenCalledTimes(2);
  });

  it("coalesces 1,000 simultaneous heartbeat requests into one count query", async () => {
    const { service, repository } = fixture();
    const count = deferred<OnlineCountSnapshot>();
    repository.getOnlineCount.mockReturnValueOnce(count.promise);
    const requests = Array.from({ length: 1_000 }, (_, index) => service.heartbeat(`user-${index}`));
    await Promise.resolve();
    expect(repository.heartbeat).toHaveBeenCalledTimes(1_000);
    expect(repository.getOnlineCount).toHaveBeenCalledTimes(1);
    count.resolve(snapshot);
    const results = await Promise.all(requests);
    expect(results.every((result) => result.success && result.data.count === 3)).toBe(true);
  });

  it("uses six count queries for 1,000 heartbeats spread across one minute", async () => {
    const { service, repository, setNow } = fixture();
    for (let index = 0; index < 1_000; index += 1) {
      setNow(index * 60);
      await service.heartbeat(`user-${index}`);
    }
    expect(repository.heartbeat).toHaveBeenCalledTimes(1_000);
    expect(repository.getOnlineCount).toHaveBeenCalledTimes(6);
  });

  it("expires from query start rather than completion or the database wall clock", async () => {
    const { service, repository, setNow } = fixture();
    const count = deferred<OnlineCountSnapshot>();
    repository.getOnlineCount.mockReturnValueOnce(count.promise);
    const request = service.heartbeat("user-a");
    await Promise.resolve();
    setNow(12_000);
    count.resolve({ count: 1, measuredAt: "2099-01-01T00:00:00.000Z" });
    await request;
    await service.heartbeat("user-b");
    expect(repository.getOnlineCount).toHaveBeenCalledTimes(2);
  });

  it("returns a failure when a write fails even if a cached count is available", async () => {
    const { service, repository } = fixture();
    await service.heartbeat("user-a");
    repository.heartbeat.mockRejectedValueOnce(new Error("Storage unavailable"));
    expect(await service.heartbeat("user-b")).toMatchObject({ success: false, code: "PRESENCE_UNAVAILABLE" });
    expect(repository.getOnlineCount).toHaveBeenCalledTimes(1);
  });

  it("never caches count failures or substitutes zero, and retries after rejection", async () => {
    const { service, repository } = fixture();
    const count = deferred<OnlineCountSnapshot>();
    repository.getOnlineCount.mockReturnValueOnce(count.promise);
    const requests = [service.heartbeat("user-a"), service.heartbeat("user-b")];
    await Promise.resolve();
    count.reject(new Error("Storage unavailable"));
    for (const result of await Promise.all(requests)) {
      expect(result).toMatchObject({ success: false, code: "PRESENCE_UNAVAILABLE" });
      expect(result).not.toHaveProperty("data");
    }
    expect(await service.heartbeat("user-c")).toEqual({ success: true, data: snapshot });
    expect(repository.getOnlineCount).toHaveBeenCalledTimes(2);
  });

  it("does not serve expired cached data when a refresh fails", async () => {
    const { service, repository, setNow } = fixture();
    await service.heartbeat("user-a");
    setNow(10_000);
    repository.getOnlineCount.mockRejectedValueOnce(new Error("Storage unavailable"));
    expect(await service.heartbeat("user-a")).toMatchObject({ success: false });
  });
});
