// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ action: vi.fn(), updateSession: vi.fn() }));
vi.mock("@/app/actions/sync-profile", () => ({ syncProfileFromKeycloak: mocks.action }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ update: mocks.updateSession }) }));
vi.mock("@/lib/deployment/version", () => ({ DEPLOYMENT_VERSION: "build-a" }));

import { checkDeploymentVersion } from "@/lib/deployment/client";
import { useProfileSync } from "@/lib/hooks/use-profile-sync";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("settles a stale profile sync without requests, session changes, or repeated error callbacks", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ version: "build-b" })));
  await checkDeploymentVersion();
  const onSyncError = vi.fn();
  const onSyncSuccess = vi.fn();
  const { result } = renderHook(() => useProfileSync({ syncOnFocus: false, onSyncError, onSyncSuccess }));
  await act(async () => {
    expect(await result.current.syncProfile()).toBeUndefined();
  });
  expect(result.current.isSyncing).toBe(false);
  expect(result.current.lastSyncResult).toBeNull();
  expect(mocks.action).not.toHaveBeenCalled();
  expect(mocks.updateSession).not.toHaveBeenCalled();
  expect(onSyncError).not.toHaveBeenCalled();
  expect(onSyncSuccess).not.toHaveBeenCalled();
});
