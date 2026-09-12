import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

const root = resolve(import.meta.dirname, "..");
const migration = "20260912072555_add_notification_soft_delete";
const container = `sraw-migrations-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const temporary = await mkdtemp(join(tmpdir(), "sraw-migrations-"));
const require = createRequire(import.meta.url);
let activeChild;
let containerStarted = false;
let cleanupPromise;

// All database URLs below are constructed from this new container. Never consume
// DATABASE_URL from .env or the caller, even when running inside a deployment job.
async function command(executable, args, { env = process.env, expected = 0, quiet = false } = {}) {
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
  if (!quiet || result.code !== expected) process.stdout.write(result.output);
  assert.equal(result.code, expected, `${executable} ${args[0]} exited unexpectedly`);
  return result.output.trim();
}

async function cleanup() {
  cleanupPromise ??= (async () => {
    try {
      if (containerStarted) {
        await command("docker", ["rm", "--force", container], { quiet: true });
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  })();
  return cleanupPromise;
}

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.once(signal, () => {
    activeChild?.kill("SIGTERM");
    void cleanup().finally(() => process.exit(code));
  });
}

function testEnvironment(url, phase) {
  return {
    ...process.env,
    DATABASE_URL: url,
    MIGRATION_TEST_DATABASE_URL: url,
    MIGRATION_TEST_CONTAINER: container,
    MIGRATION_TEST_PHASE: phase,
    NODE_ENV: "test",
  };
}

async function withDatabase(url, callback) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function seedFixtures(url) {
  await withDatabase(url, async (client) => {
    for (const id of ["migration-user-a", "migration-user-b"]) {
      await client.query(
        'INSERT INTO "users" ("id", "keycloak_id", "email", "first_name", "last_name", "updated_at") VALUES ($1, $1, $2, $3, $4, $5)',
        [id, `${id}@example.test`, "ผู้ใช้ทดสอบ", "การย้ายฐานข้อมูล", "2026-09-01T00:00:00Z"],
      );
      await client.query(
        'INSERT INTO "push_subscriptions" ("id", "user_id", "endpoint", "p256dh", "auth", "user_agent") VALUES ($1, $2, $3, $4, $5, $6)',
        [`push-${id}`, id, `https://push.example.test/${id}`, "fixture-key", "fixture-auth", "Migration fixture"],
      );
    }
    const fixtures = [
      ["a-unread", "migration-user-a", false, null],
      ["a-delete", "migration-user-a", false, null],
      ["a-read", "migration-user-a", true, "2026-09-02T01:00:00Z"],
      ["b-unread", "migration-user-b", false, null],
      ["b-read", "migration-user-b", true, "2026-09-02T01:00:00Z"],
    ];
    for (const [id, user, read, readAt] of fixtures) {
      await client.query(
        'INSERT INTO "notifications" ("id", "user_id", "type", "title", "body", "link", "is_read", "read_at", "created_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [id, user, "SYSTEM_ANNOUNCEMENT", `ทดสอบ ${id}`, "ข้อมูลเดิมต้องคงอยู่", read ? "/dashboard" : null, read, readAt, "2026-09-01T00:00:00Z"],
      );
    }
  });
}

async function snapshot(url) {
  return withDatabase(url, async (client) => ({
    users: (await client.query('SELECT to_jsonb(u) AS row FROM "users" u ORDER BY id')).rows,
    notifications: (await client.query("SELECT to_jsonb(n) - 'is_deleted' - 'deleted_at' AS row FROM notifications n ORDER BY id")).rows,
    subscriptions: (await client.query('SELECT to_jsonb(s) AS row FROM "push_subscriptions" s ORDER BY id')).rows,
  }));
}

async function integration(url, phase) {
  await command("bun", ["x", "--no-install", "vitest", "run", "--config", "vitest.migrations.config.mjs"], {
    env: testEnvironment(url, phase),
  });
}

try {
  await command("docker", ["version", "--format", "{{.Server.Version}}"], { quiet: true });
  console.log("Starting disposable PostgreSQL 17.7 (application DATABASE_URL is ignored).");
  // Mark before starting so an interrupted docker run still removes this named container.
  containerStarted = true;
  await command("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--publish", "127.0.0.1::5432",
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--env", "POSTGRES_DB=migration_admin",
    "postgres:17.7",
  ], { quiet: true });
  const binding = await command("docker", ["port", container, "5432/tcp"], { quiet: true });
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const baseUrl = `postgresql://postgres:${password}@${binding}/`;
  const adminUrl = `${baseUrl}migration_admin`;
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
    await client.query('CREATE DATABASE "migration_upgrade"');
    await client.query('CREATE DATABASE "migration_fresh"');
  });

  const migrationsPath = join(root, "prisma/migrations");
  const names = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const boundary = names.indexOf(migration);
  assert.ok(boundary > 0, "Notification soft-delete migration was not found");
  const baselinePath = join(temporary, "migrations");
  await cp(migrationsPath, baselinePath, { recursive: true });
  for (const name of names.slice(boundary)) {
    await rm(join(baselinePath, name), { recursive: true });
  }
  const baselineConfig = join(temporary, "prisma.config.mjs");
  await writeFile(baselineConfig, `import { defineConfig } from ${JSON.stringify(require.resolve("prisma/config"))};
export default defineConfig({
  schema: ${JSON.stringify(join(root, "prisma/schema.prisma"))},
  migrations: { path: ${JSON.stringify(baselinePath)} },
  datasource: { url: process.env.DATABASE_URL }
});\n`);

  const upgradeUrl = `${baseUrl}migration_upgrade`;
  const upgradeEnv = testEnvironment(upgradeUrl, "before");
  console.log("Replaying migration history before notification soft deletion.");
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy", "--config", baselineConfig], { env: upgradeEnv });
  await seedFixtures(upgradeUrl);
  const before = await snapshot(upgradeUrl);
  await command("bun", ["run", "check:schema"], { env: upgradeEnv, expected: 2 });
  await integration(upgradeUrl, "before");

  console.log("Upgrading existing data and checking complete preservation.");
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], { env: upgradeEnv });
  assert.deepEqual(await snapshot(upgradeUrl), before, "Migration changed existing data");
  await command("bun", ["run", "check:schema"], { env: upgradeEnv });
  await integration(upgradeUrl, "after");
  const history = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "_prisma_migrations" ORDER BY migration_name'));
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], { env: upgradeEnv });
  const repeated = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "_prisma_migrations" ORDER BY migration_name'));
  assert.deepEqual(repeated.rows, history.rows, "Repeated deploy changed migration history");

  console.log("Checking a fresh installation against the current Prisma schema.");
  const freshUrl = `${baseUrl}migration_fresh`;
  const freshEnv = testEnvironment(freshUrl, "fresh");
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], { env: freshEnv });
  await command("bun", ["run", "check:schema"], { env: freshEnv });
  await seedFixtures(freshUrl);
  await integration(freshUrl, "fresh");
  console.log("Migration checks passed: missing-schema rejection, data preservation, upgrade, fresh install, notification behavior, readiness, and repeat deployment.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
