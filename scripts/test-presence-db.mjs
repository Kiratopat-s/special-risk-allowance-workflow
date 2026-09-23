import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

// Every URL is constructed from this disposable container. Never use the
// application's DATABASE_URL, including when this script is run from CI.
const root = resolve(import.meta.dirname, "..");
const migration = "20260923090000_add_user_presence";
const container = `sraw-presence-test-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const temporary = await mkdtemp(join(tmpdir(), "sraw-presence-test-"));
const require = createRequire(import.meta.url);
let activeChild;
let containerStarted = false;
let cleanupPromise;

async function command(executable, args, env = process.env, quiet = false) {
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(executable, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    activeChild = child;
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (activeChild === child) activeChild = undefined;
      resolveResult({ code, output });
    });
  });
  if (!quiet || result.code) process.stdout.write(result.output);
  assert.equal(result.code, 0, `${executable} ${args[0]} failed`);
  return result.output.trim();
}

function cleanup() {
  return cleanupPromise ??= (async () => {
    try {
      if (containerStarted) await command("docker", ["rm", "--force", container], process.env, true);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  })();
}

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.once(signal, () => {
    activeChild?.kill("SIGTERM");
    void cleanup().finally(() => process.exit(code));
  });
}

async function withDatabase(url, callback) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 1000 });
  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.end();
  }
}

function testEnvironment(url) {
  return {
    ...process.env,
    DATABASE_URL: url,
    PRESENCE_TEST_DATABASE_URL: url,
    PRESENCE_TEST_CONTAINER: container,
    NODE_ENV: "test",
  };
}

async function snapshot(url) {
  return withDatabase(url, async (client) => ({
    users: (await client.query('SELECT to_jsonb(u) AS row FROM "users" u ORDER BY id')).rows,
    logs: (await client.query('SELECT to_jsonb(l) AS row FROM "user_action_logs" l ORDER BY id')).rows,
  }));
}

async function verifySchemaAndBehavior(url) {
  const env = testEnvironment(url);
  await command("bun", ["run", "check:schema"], env);
  await command("bun", ["x", "--no-install", "vitest", "run", "--config", "vitest.presence.config.mjs"], env);
}

try {
  await command("docker", ["version", "--format", "{{.Server.Version}}"], process.env, true);
  console.log("Starting disposable PostgreSQL 17.7 for presence (application DATABASE_URL is ignored).");
  containerStarted = true;
  await command("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--publish", "127.0.0.1::5432",
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--env", "POSTGRES_DB=presence_admin", "postgres:17.7",
  ], process.env, true);
  const binding = await command("docker", ["port", container, "5432/tcp"], process.env, true);
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const baseUrl = `postgresql://postgres:${password}@${binding}/`;
  const adminUrl = `${baseUrl}presence_admin`;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await withDatabase(adminUrl, (client) => client.query("SELECT 1"));
      ready = true;
      break;
    } catch {
      await delay(500);
    }
  }
  assert.ok(ready, "Disposable PostgreSQL did not become ready");
  await withDatabase(adminUrl, async (client) => {
    await client.query('CREATE DATABASE "presence_upgrade"');
    await client.query('CREATE DATABASE "presence_fresh"');
  });

  const migrationsPath = join(root, "prisma/migrations");
  const names = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const boundary = names.indexOf(migration);
  assert.ok(boundary > 0, "Presence migration was not found");
  const baselinePath = join(temporary, "migrations");
  await cp(migrationsPath, baselinePath, { recursive: true });
  for (const name of names.slice(boundary)) await rm(join(baselinePath, name), { recursive: true });
  const baselineConfig = join(temporary, "prisma.config.mjs");
  await writeFile(baselineConfig, `import { defineConfig } from ${JSON.stringify(require.resolve("prisma/config"))};
export default defineConfig({
  schema: ${JSON.stringify(join(root, "prisma/schema.prisma"))},
  migrations: { path: ${JSON.stringify(baselinePath)} },
  datasource: { url: process.env.DATABASE_URL }
});\n`);

  const upgradeUrl = `${baseUrl}presence_upgrade`;
  const upgradeEnv = testEnvironment(upgradeUrl);
  console.log("Replaying migration history before presence and seeding existing data.");
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy", "--config", baselineConfig], upgradeEnv);
  await withDatabase(upgradeUrl, async (client) => {
    await client.query(`INSERT INTO "users" ("id", "keycloak_id", "email", "first_name", "last_name", "last_login_at", "updated_at")
      VALUES ('presence-upgrade-user', 'presence-upgrade-user', 'upgrade@example.test', 'Existing', 'User', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')`);
    await client.query(`INSERT INTO "user_action_logs" ("id", "user_id", "action_type", "action_description")
      VALUES ('presence-upgrade-log', 'presence-upgrade-user', 'LOGIN', 'Preserve existing audit history')`);
  });
  const before = await snapshot(upgradeUrl);
  console.log("Applying presence migration and checking existing user/audit preservation.");
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], upgradeEnv);
  assert.deepEqual(await snapshot(upgradeUrl), before, "Presence migration changed existing data");
  const presence = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "user_presence"'));
  assert.deepEqual(presence.rows, [], "Presence must start empty without a backfill");
  const history = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "_prisma_migrations" ORDER BY migration_name'));
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], upgradeEnv);
  const repeated = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "_prisma_migrations" ORDER BY migration_name'));
  assert.deepEqual(repeated.rows, history.rows, "Repeated deploy changed migration history");
  await verifySchemaAndBehavior(upgradeUrl);

  console.log("Checking fresh migration replay and presence behavior.");
  const freshUrl = `${baseUrl}presence_fresh`;
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], testEnvironment(freshUrl));
  await verifySchemaAndBehavior(freshUrl);
  console.log("Presence PostgreSQL checks passed: upgrade, fresh install, repeat deployment, concurrency, expiry, write throttling, and 1,000 accounts.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
