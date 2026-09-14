import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { resolveDeploymentVersion } from "../scripts/deployment-version.mjs";

const roots: string[] = [];
const commit = "1234567890abcdef1234567890abcdef12345678";
const now = new Date("2026-09-14T10:30:40.123Z");
function checkout(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "sraw-build-version-"));
  roots.push(root);
  mkdirSync(join(root, ".git/refs/heads/release"), { recursive: true });
  for (const [path, value] of Object.entries(files)) writeFileSync(join(root, ".git", path), value);
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true }); });

it("preserves an explicit CI deployment version without needing Git metadata", () => {
  expect(resolveDeploymentVersion({ env: { DEPLOYMENT_VERSION: "ci-release-123" }, root: "/missing" })).toBe("ci-release-123");
});

it("uses the injected GitHub commit without needing Git metadata", () => {
  expect(resolveDeploymentVersion({ env: { GIT_COMMIT_SHA: commit }, root: "/missing", now })).toMatch(/^1234567890ab-20260914T103040123Z-[a-f0-9]{8}$/);
});

it.each([
  { HEAD: `${commit}\n` },
  { HEAD: "ref: refs/heads/main\n", "refs/heads/main": `${commit}\n` },
  { HEAD: "ref: refs/heads/release/uat\n", "refs/heads/release/uat": `${commit}\n` },
  { HEAD: "ref: refs/heads/main\n", "packed-refs": `# pack-refs with: peeled\n${commit} refs/heads/main\n` },
])("reads detached, branch, nested branch and packed Git refs: %j", (files) => {
  const root = checkout(files);
  expect(resolveDeploymentVersion({ root, env: {}, now })).toMatch(/^1234567890ab-20260914T103040123Z-[a-f0-9]{8}$/);
});

it("gives fresh compilations of the same commit distinct versions", () => {
  const options = { env: { GIT_COMMIT_SHA: commit }, now };
  expect(resolveDeploymentVersion(options)).not.toBe(resolveDeploymentVersion(options));
});

it.each([
  {},
  { HEAD: "not-a-commit" },
  { HEAD: "ref: refs/heads/../../config" },
])("reports unavailable or invalid metadata clearly: %j", (files) => {
  expect(() => resolveDeploymentVersion({ root: checkout(files), env: {} })).toThrow("Cannot determine Git commit");
});

it("rejects an invalid injected SHA instead of silently using the checkout", () => {
  expect(() => resolveDeploymentVersion({ root: checkout({ HEAD: commit }), env: { GIT_COMMIT_SHA: "invalid" } })).toThrow("Cannot determine Git commit");
});
