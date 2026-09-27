import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { EmailWorkerConfigurationError } from "@/lib/email/configuration-error";
import { runDeliveryLoop, runEmailWorker } from "../scripts/email-worker";

const workerFixtureEnvironment = {
  NODE_ENV: "production",
  EMAIL_HOST: "127.0.0.1",
  EMAIL_PORT: "1",
  EMAIL_USER: "fixture-smtp-username-not-for-output",
  EMAIL_PASS: "fixture-smtp-password-not-for-output",
  EMAIL_FROM: "Private Fixture Sender <fixture-sender@example.test>",
  NEXTAUTH_URL: "https://fixture-app.example.test",
  DATABASE_URL: "postgresql://fixture-db-user:fixture-db-password@127.0.0.1:1/fixture-db",
};

function stubWorkerEnvironment(overrides: Record<string, string> = {}) {
  for (const [name, value] of Object.entries({ ...workerFixtureEnvironment, ...overrides })) vi.stubEnv(name, value);
}

function runWorkerCli(overrides: Record<string, string> = {}, args = ["--check-config"]) {
  return spawnSync("bun", ["scripts/email-worker.ts", ...args], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    // Override every worker setting so neither dotenv nor the parent process can
    // provide a real SMTP server, account, recipient or database connection.
    env: { ...process.env, ...workerFixtureEnvironment, ...overrides },
    encoding: "utf8",
    timeout: 3_000,
    maxBuffer: 64 * 1024,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("email worker delivery loop", () => {
  it("drains queued jobs sequentially and does not acquire another while a send is active", async () => {
    const controller = new AbortController();
    let finishFirst!: (processed: boolean) => void;
    const processNext = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(async () => { controller.abort(); return false; });
    const progress = vi.fn();
    const running = runDeliveryLoop({ processNext }, controller.signal, progress);
    await Promise.resolve();
    expect(processNext).toHaveBeenCalledTimes(1);
    expect(progress).not.toHaveBeenCalled();
    finishFirst(true);
    await running;
    expect(processNext).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledTimes(3);
  });

  it("waits for the active job after shutdown and does not start another", async () => {
    const controller = new AbortController();
    let finishActive!: (processed: boolean) => void;
    const processNext = vi.fn(() => new Promise<boolean>((resolve) => { finishActive = resolve; }));
    let stopped = false;
    const running = runDeliveryLoop({ processNext }, controller.signal, vi.fn()).then(() => { stopped = true; });
    controller.abort();
    await Promise.resolve();
    expect(stopped).toBe(false);
    finishActive(true);
    await running;
    expect(stopped).toBe(true);
    expect(processNext).toHaveBeenCalledOnce();
  });

  it("polls an idle queue after 15 seconds and wakes immediately when stopped", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const processNext = vi.fn().mockResolvedValue(false);
    const running = runDeliveryLoop({ processNext }, controller.signal, vi.fn());
    await vi.advanceTimersByTimeAsync(14_999);
    expect(processNext).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(processNext).toHaveBeenCalledTimes(2);
    controller.abort();
    await running;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("backs off after an error without logging secrets or claiming healthy progress", async () => {
    vi.useFakeTimers();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const controller = new AbortController();
    const processNext = vi.fn()
      .mockRejectedValueOnce(new Error("postgresql://private-password@database"))
      .mockImplementationOnce(async () => { controller.abort(); return false; });
    const progress = vi.fn();
    const running = runDeliveryLoop({ processNext }, controller.signal, progress);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(processNext).toHaveBeenCalledOnce();
    expect(progress).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledExactlyOnceWith("[email-worker] DELIVERY_PROCESSING_FAILED");
    await vi.advanceTimersByTimeAsync(1);
    await running;
    expect(progress).toHaveBeenCalledOnce();
  });

  it("does not acquire a job when shutdown has already begun", async () => {
    const controller = new AbortController();
    controller.abort();
    const processNext = vi.fn();
    await runDeliveryLoop({ processNext }, controller.signal, vi.fn());
    expect(processNext).not.toHaveBeenCalled();
  });
});

describe("email worker configuration command", () => {
  it("checks local configuration without opening SMTP or the database", async () => {
    stubWorkerEnvironment();
    const createTransport = vi.spyOn(nodemailer, "createTransport");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(runEmailWorker(["--check-config"])).resolves.toBeUndefined();
    expect(createTransport).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith("[email-worker] Configuration valid; no database or SMTP connection attempted.");
  });

  it("reports missing SMTP, app URL and database settings together before loading runtime services", async () => {
    stubWorkerEnvironment({ EMAIL_HOST: "", EMAIL_USER: "", EMAIL_PASS: "", NEXTAUTH_URL: "", DATABASE_URL: "" });
    const createTransport = vi.spyOn(nodemailer, "createTransport");
    const failure = await runEmailWorker(["--check-config"]).catch((cause: unknown) => cause);
    expect(failure).toBeInstanceOf(EmailWorkerConfigurationError);
    expect((failure as EmailWorkerConfigurationError).issues).toHaveLength(5);
    expect((failure as EmailWorkerConfigurationError).issues).toEqual(expect.arrayContaining([
      "EMAIL_HOST_REQUIRED", "EMAIL_USER_REQUIRED", "EMAIL_PASS_REQUIRED", "NEXTAUTH_URL_REQUIRED", "DATABASE_URL_REQUIRED",
    ]));
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("distinguishes malformed SMTP fields and database URL from a production HTTPS requirement", async () => {
    stubWorkerEnvironment({
      EMAIL_HOST: "private invalid host", EMAIL_PORT: "private-invalid-port", EMAIL_FROM: "private-invalid-sender",
      NEXTAUTH_URL: "http://fixture-app.example.test", DATABASE_URL: "private-invalid-database-url",
    });
    const failure = await runEmailWorker(["--check-config"]).catch((cause: unknown) => cause);
    expect(failure).toBeInstanceOf(EmailWorkerConfigurationError);
    expect((failure as EmailWorkerConfigurationError).issues).toHaveLength(5);
    expect((failure as EmailWorkerConfigurationError).issues).toEqual(expect.arrayContaining([
      "EMAIL_HOST_INVALID", "EMAIL_PORT_INVALID", "EMAIL_FROM_INVALID", "NEXTAUTH_URL_HTTPS_REQUIRED", "DATABASE_URL_INVALID",
    ]));
  });

  it("rejects unsupported arguments before loading runtime services", async () => {
    await expect(runEmailWorker(["--unsafe-flag"])).rejects.toThrow("WORKER_ARGUMENT_INVALID");
  });
});

describe("email worker CLI diagnostics", () => {
  it("exits successfully for valid local configuration with unreachable fixture services", () => {
    const result = runWorkerCli();
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Configuration valid; no database or SMTP connection attempted.");
    expect(result.stderr).toBe("");
  });

  it.each([
    {
      overrides: { EMAIL_HOST: "", EMAIL_USER: "", EMAIL_PASS: "", NEXTAUTH_URL: "", DATABASE_URL: "" },
      issues: ["EMAIL_HOST_REQUIRED", "EMAIL_USER_REQUIRED", "EMAIL_PASS_REQUIRED", "NEXTAUTH_URL_REQUIRED", "DATABASE_URL_REQUIRED"],
      sensitive: [],
    },
    {
      overrides: {
        EMAIL_HOST: "sensitive-invalid-host value", EMAIL_PORT: "sensitive-invalid-port", EMAIL_FROM: "sensitive-invalid-sender",
        NEXTAUTH_URL: "https://sensitive-url-user:sensitive-url-password@fixture-app.example.test",
        DATABASE_URL: "sensitive-invalid-database-url",
      },
      issues: ["EMAIL_HOST_INVALID", "EMAIL_PORT_INVALID", "EMAIL_FROM_INVALID", "NEXTAUTH_URL_INVALID", "DATABASE_URL_INVALID"],
      sensitive: ["sensitive-invalid-host", "sensitive-invalid-port", "sensitive-invalid-sender", "sensitive-url-user", "sensitive-url-password", "sensitive-invalid-database-url"],
    },
    {
      overrides: { NEXTAUTH_URL: "http://sensitive-insecure-app.example.test" },
      issues: ["NEXTAUTH_URL_HTTPS_REQUIRED"],
      sensitive: ["sensitive-insecure-app.example.test"],
    },
  ])("exits nonzero with actionable safe diagnostics for $issues", ({ overrides, issues, sensitive }) => {
    const result = runWorkerCli(overrides);
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[email-worker] WORKER_CONFIGURATION_INVALID; correct the settings below.");
    for (const issue of issues) expect(result.stderr).toContain(`[email-worker] ${issue}: `);
    const output = result.stdout + result.stderr;
    for (const value of [
      ...sensitive, workerFixtureEnvironment.EMAIL_USER, workerFixtureEnvironment.EMAIL_PASS,
      workerFixtureEnvironment.EMAIL_FROM, "fixture-db-user", "fixture-db-password", "fixture-app.example.test",
    ]) expect(output).not.toContain(value);
    expect(output).not.toContain("WORKER_STARTUP_FAILED");
    expect(output).not.toContain("Error:");
  });

  it("keeps unexpected argument failures generic and does not echo arguments or settings", () => {
    const result = runWorkerCli({}, ["--private-argument-not-for-output"]);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("WORKER_STARTUP_FAILED");
    expect(result.stderr).not.toContain("WORKER_CONFIGURATION_INVALID");
    expect(result.stderr).not.toContain("private-argument-not-for-output");
    expect(result.stderr).not.toContain(workerFixtureEnvironment.EMAIL_PASS);
  });
});
