import { afterEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { runDeliveryLoop, runEmailWorker } from "../scripts/email-worker";

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
    vi.stubEnv("EMAIL_HOST", "smtp.example.test");
    vi.stubEnv("EMAIL_PORT", "587");
    vi.stubEnv("EMAIL_USER", "worker");
    vi.stubEnv("EMAIL_PASS", "secret-test-value");
    vi.stubEnv("EMAIL_FROM", "SRAW <noreply@example.test>");
    vi.stubEnv("NEXTAUTH_URL", "https://sraw.example.test");
    // This is deliberately unreachable. --check-config must not attempt a connection.
    vi.stubEnv("DATABASE_URL", "postgresql://worker:secret@127.0.0.1:1/example");
    const createTransport = vi.spyOn(nodemailer, "createTransport");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(runEmailWorker(["--check-config"])).resolves.toBeUndefined();
    expect(createTransport).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith("[email-worker] Configuration valid; no database or SMTP connection attempted.");
  });

  it("rejects unsupported arguments before loading runtime services", async () => {
    await expect(runEmailWorker(["--unsafe-flag"])).rejects.toThrow("WORKER_ARGUMENT_INVALID");
  });
});
