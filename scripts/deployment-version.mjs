import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const isCommit = (value) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value);

function readOptional(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return "";
    throw error;
  }
}

function readCommit(root) {
  const head = readOptional(resolve(root, ".git/HEAD"));
  if (isCommit(head)) return head;
  const ref = head.replace(/^ref: /, "");
  if (!ref.startsWith("refs/heads/") || ref.split("/").some((part) => !part || part === "." || part === "..")) return "";
  const loose = readOptional(resolve(root, ".git", ref));
  if (isCommit(loose)) return loose;
  for (const line of readOptional(resolve(root, ".git/packed-refs")).split("\n")) {
    const [commit, name] = line.split(" ");
    if (name === ref && isCommit(commit)) return commit;
  }
  return "";
}

export function resolveDeploymentVersion({ root = process.cwd(), env = process.env, now = new Date() } = {}) {
  const explicit = env.DEPLOYMENT_VERSION?.trim();
  if (explicit) return explicit;
  const commit = env.GIT_COMMIT_SHA?.trim() || readCommit(root);
  if (!commit || !isCommit(commit)) {
    throw new Error("Cannot determine Git commit. Build from a Git checkout, or pass --build-arg GIT_COMMIT_SHA=\"$(git rev-parse HEAD)\" (or DEPLOYMENT_VERSION) for archives/worktrees without Git metadata.");
  }
  const timestamp = now.toISOString().replace(/[-:.]/g, "");
  // A fresh compile needs a fresh version even when rebuilding the same commit.
  return `${commit.slice(0, 12).toLowerCase()}-${timestamp}-${randomUUID().slice(0, 8)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.stdout.write(resolveDeploymentVersion());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
