import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

// A newly created database only; never use the application's DATABASE_URL.
const container = `sraw-department-test-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
let child;
let cleaning;
async function run(command, args, env = process.env, quiet = false) {
  const result = await new Promise((resolve, reject) => {
    const processChild = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    child = processChild;
    let output = "";
    processChild.stdout.on("data", (data) => { output += data; });
    processChild.stderr.on("data", (data) => { output += data; });
    processChild.on("error", reject);
    processChild.on("close", (code) => { child = null; resolve({ code, output }); });
  });
  if (!quiet || result.code) process.stdout.write(result.output);
  assert.equal(result.code, 0, `${command} failed`);
  return result.output.trim();
}
function cleanup() {
  return cleaning ??= run("docker", ["rm", "--force", container], process.env, true).catch(() => {});
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  child?.kill(signal);
  void cleanup().finally(() => { process.exitCode = 1; });
});
try {
  await run("docker", ["run", "--detach", "--rm", "--name", container, "--publish", "127.0.0.1::5432", "--env", `POSTGRES_PASSWORD=${password}`, "--env", "POSTGRES_DB=department_test", "postgres:17.7"], process.env, true);
  const binding = await run("docker", ["port", container, "5432/tcp"], process.env, true);
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const url = `postgresql://postgres:${password}@${binding}/department_test`;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 1000 });
    try { await client.connect(); await client.query("SELECT 1"); ready = true; break; }
    catch { await delay(500); }
    finally { await client.end(); }
  }
  assert.ok(ready, "Test database did not become ready");
  const env = { ...process.env, DATABASE_URL: url, DEPARTMENT_TEST_DATABASE_URL: url, DEPARTMENT_TEST_CONTAINER: container, NODE_ENV: "test" };
  await run("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], env);
  await run("bun", ["x", "--no-install", "vitest", "run", "--config", "vitest.department.config.mjs"], env);
} catch (cause) {
  console.error(cause);
  process.exitCode = 1;
} finally {
  await cleanup();
}
