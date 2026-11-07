"use client";

import { DEPLOYMENT_VERSION } from "./version";

let outdated = false;
let versionCheck: Promise<void> | undefined;
const listeners = new Set<() => void>();

export const isDeploymentOutdated = () => outdated;
export const getServerDeploymentSnapshot = () => false;

export function subscribeToDeployment(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function markOutdated() {
  if (outdated) return;
  outdated = true;
  listeners.forEach((listener) => listener());
}

export function checkDeploymentVersion(): Promise<void> {
  if (outdated || !DEPLOYMENT_VERSION) return Promise.resolve();
  if (versionCheck) return versionCheck;
  versionCheck = (async () => {
    try {
      const response = await fetch("/api/version", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (data && typeof data === "object" && "version" in data &&
          typeof data.version === "string" && data.version && data.version !== DEPLOYMENT_VERSION) {
        markOutdated();
      }
    } catch {
      // An unavailable version endpoint does not mean the deployment changed.
    }
  })().finally(() => { versionCheck = undefined; });
  return versionCheck;
}

function isUnrecognizedAction(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "UnrecognizedActionError" ||
    /^Failed to find Server Action\b/.test(error.message) ||
    /^Server Action ".+" was not found on the server\./.test(error.message);
}

/** Safety net: a request left half-open by a deployment swap must not freeze a form forever. */
export const ACTION_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server Action timed out")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Undefined means stop this flow without resetting input or replaying the action. */
export async function runServerAction<T>(action: () => Promise<T>): Promise<T | undefined> {
  // A focus/visibility check may already be discovering a newer deployment.
  if (versionCheck) await versionCheck;
  if (outdated) return undefined;
  try {
    return await withTimeout(action(), ACTION_TIMEOUT_MS);
  } catch (error) {
    if (isUnrecognizedAction(error)) {
      markOutdated();
      return undefined;
    }
    // A deployment swap can surface as a dropped connection or a hung request
    // instead of UnrecognizedActionError. Confirm via the version endpoint
    // before handing the error to the caller.
    await checkDeploymentVersion();
    if (outdated) return undefined;
    throw error;
  }
}
