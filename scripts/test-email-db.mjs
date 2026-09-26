import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

// Every database URL belongs to this new container. Never use DATABASE_URL
// inherited from the application, shell, dotenv, or deployment environment.
const root = resolve(import.meta.dirname, "..");
const migration = "20260926090000_add_email_delivery_outbox";
const container = `sraw-email-test-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const temporary = await mkdtemp(join(tmpdir(), "sraw-email-test-"));
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
    EMAIL_TEST_DATABASE_URL: url,
    EMAIL_TEST_CONTAINER: container,
    NODE_ENV: "test",
  };
}

async function snapshot(url) {
  return withDatabase(url, async (client) => {
    const result = {};
    for (const table of ["users", "expense_claims", "off_site_works", "expense_claim_off_site_work", "leader_verifications"]) {
      result[table] = (await client.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows;
    }
    return result;
  });
}

async function seedExistingRequest(url) {
  await withDatabase(url, async (client) => {
    await client.query(`INSERT INTO users (id, keycloak_id, email, first_name, last_name, updated_at)
      VALUES ('existing-claimant', 'existing-claimant', 'claimant@example.test', 'Existing', 'Claimant', NOW()),
        ('existing-leader', 'existing-leader', 'leader@example.test', 'Existing', 'Leader', NOW())`);
    await client.query(`INSERT INTO expense_claims
      (id, expense_month, user_id, claimant_position_at_submission, created_by_id, status)
      VALUES ('existing-claim', '2026-09-01', 'existing-claimant', 'Staff', 'existing-claimant', 'PENDING_LEADER_VERIFY')`);
    await client.query(`INSERT INTO off_site_works (id, start_date, end_date, posted_by_user_id, leader_user_id)
      VALUES ('existing-work', '2026-09-01', '2026-09-02', 'existing-claimant', 'existing-leader')`);
    await client.query(`INSERT INTO expense_claim_off_site_work (expense_claim_id, off_site_work_id)
      VALUES ('existing-claim', 'existing-work')`);
    await client.query(`INSERT INTO leader_verifications (id, expense_claim_id, off_site_work_id, leader_user_id, token, expires_at)
      VALUES ('existing-verification', 'existing-claim', 'existing-work', 'existing-leader', 'existing-token', NOW() + INTERVAL '7 days')`);
  });
}

async function verifySchemaAndBehavior(url) {
  const env = testEnvironment(url);
  await command("bun", ["run", "check:schema"], env);
  await command("bun", ["x", "--no-install", "vitest", "run", "--config", "vitest.email.config.mjs"], env);
}

try {
  await command("docker", ["version", "--format", "{{.Server.Version}}"], process.env, true);
  console.log("Starting disposable PostgreSQL 17.7 for email delivery (application DATABASE_URL is ignored).");
  containerStarted = true;
  await command("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--publish", "127.0.0.1::5432",
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--env", "POSTGRES_DB=email_admin", "postgres:17.7",
  ], process.env, true);
  const binding = await command("docker", ["port", container, "5432/tcp"], process.env, true);
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const baseUrl = `postgresql://postgres:${password}@${binding}/`;
  const adminUrl = `${baseUrl}email_admin`;
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
    await client.query('CREATE DATABASE "email_upgrade"');
    await client.query('CREATE DATABASE "email_fresh"');
  });

  const migrationsPath = join(root, "prisma/migrations");
  const names = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const boundary = names.indexOf(migration);
  assert.ok(boundary > 0, "Email delivery migration was not found");
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

  const upgradeUrl = `${baseUrl}email_upgrade`;
  const upgradeEnv = testEnvironment(upgradeUrl);
  console.log("Replaying migration history and seeding an existing pending verification request.");
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy", "--config", baselineConfig], upgradeEnv);
  await seedExistingRequest(upgradeUrl);
  const before = await snapshot(upgradeUrl);
  console.log("Applying email migration, preserving existing records, and checking no backfill.");
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], upgradeEnv);
  assert.deepEqual(await snapshot(upgradeUrl), before, "Email migration changed existing workflow data");
  const queued = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "email_deliveries"'));
  assert.deepEqual(queued.rows, [], "Email delivery must start empty without backfilling existing requests");
  const history = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "_prisma_migrations" ORDER BY migration_name'));
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], upgradeEnv);
  const repeated = await withDatabase(upgradeUrl, (client) => client.query('SELECT * FROM "_prisma_migrations" ORDER BY migration_name'));
  assert.deepEqual(repeated.rows, history.rows, "Repeated deploy changed migration history");
  await verifySchemaAndBehavior(upgradeUrl);

  console.log("Checking fresh migration replay and email delivery behavior.");
  const freshUrl = `${baseUrl}email_fresh`;
  await command("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], testEnvironment(freshUrl));
  await verifySchemaAndBehavior(freshUrl);
  console.log("Email PostgreSQL checks passed: migrations, no backfill, atomic enqueue, concurrency, recovery, eligibility, history and worker restart. SMTP stayed inside a loopback capture fixture; no email was delivered externally.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
