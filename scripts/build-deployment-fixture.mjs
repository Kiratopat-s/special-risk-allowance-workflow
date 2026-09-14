import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const version = process.argv[2];
if (!version || !/^[a-z0-9][a-z0-9_.-]{0,100}$/.test(version)) {
  throw new Error("Usage: node scripts/build-deployment-fixture.mjs <unique-test-version>");
}
const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const marker = "COPY . .\nARG DEPLOYMENT_VERSION";
if (!dockerfile.includes(marker)) throw new Error("Dockerfile builder changed; update the fixture injection point");
const fixtureDockerfile = dockerfile.replace(marker,
  "COPY . .\nCOPY tests/fixtures/deployment-smoke/ ./app/deployment-validation/\nARG DEPLOYMENT_VERSION");
const child = spawn("docker", ["build", "-f", "-", "--target", "runner", "--build-arg", `DEPLOYMENT_VERSION=${version}`, "-t", `sraw-deployment-validation:${version}`, "."], {
  cwd: new URL("../", import.meta.url), stdio: ["pipe", "inherit", "inherit"],
});
child.stdin.end(fixtureDockerfile);
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
