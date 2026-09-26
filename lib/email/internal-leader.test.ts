import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.createTransport } }));
import { sendInternalLeaderEmail, validateInternalEmailConfiguration, type InternalLeaderEmailInput } from "./internal-leader";

const input: InternalLeaderEmailInput = {
  to: "leader@example.test",
  deliveryId: "delivery-1",
  claimantName: "สมชาย <script>alert('name')</script>",
  expenseMonth: new Date("2026-09-01T00:00:00Z"),
  orders: [
    { reference: 'REF-1 <img src="x"> & งาน', expiresAt: new Date("2026-12-31T18:00:00Z") },
    { reference: null, expiresAt: new Date("2027-01-02T00:00:00Z") },
  ],
};

beforeEach(() => {
  vi.stubEnv("EMAIL_HOST", "smtp.example.test");
  vi.stubEnv("EMAIL_PORT", "587");
  vi.stubEnv("EMAIL_USER", "worker");
  vi.stubEnv("EMAIL_PASS", "private-password");
  vi.stubEnv("EMAIL_FROM", "ระบบ SRAW <noreply@example.test>");
  vi.stubEnv("NEXTAUTH_URL", "https://sraw.example.test");
  smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail, close: smtp.close });
  smtp.sendMail.mockResolvedValue({ accepted: [input.to], rejected: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe("internal leader email", () => {
  it("renders escaped Thai content and an authenticated queue link with the configured SMTP bounds", async () => {
    expect(await sendInternalLeaderEmail(input)).toMatchObject({ kind: "accepted" });
    const message = smtp.sendMail.mock.calls[0][0];
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("&lt;img src=&quot;x&quot;&gt; &amp;");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("กันยายน 2569");
    expect(message.html).toContain("1 มกราคม 2570");
    expect(message.html).toContain("01:00:00");
    expect(message.text).toContain(input.claimantName);
    expect(message.text).toContain("คำสั่งปฏิบัติงานรายการที่ 2");
    expect(message.text).toContain("https://sraw.example.test/dashboard?tab=leader-queue");
    expect(message.html).not.toContain("token=");
    expect(message.text).not.toContain("claimId=");
    expect(message).toMatchObject({ disableFileAccess: true, disableUrlAccess: true });
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      port: 587, secure: false, dnsTimeout: 10_000, connectionTimeout: 10_000,
      greetingTimeout: 10_000, socketTimeout: 30_000,
    }));
    expect(smtp.close).toHaveBeenCalledOnce();
  });

  it("keeps a stable safe Message-ID for retries of the same delivery", async () => {
    const first = await sendInternalLeaderEmail(input);
    const second = await sendInternalLeaderEmail({ ...input, to: "other@example.test" });
    const firstId = smtp.sendMail.mock.calls[0][0].messageId;
    expect(firstId).toMatch(/^<sraw-leader-[a-f0-9]{64}@sraw\.example\.test>$/);
    expect(smtp.sendMail.mock.calls[1][0].messageId).toBe(firstId);
    expect(first).toEqual({ kind: "accepted", messageId: firstId });
    expect(second.kind).toBe("permanent_error");
    await sendInternalLeaderEmail({ ...input, deliveryId: "delivery-2" });
    expect(smtp.sendMail.mock.calls[2][0].messageId).not.toBe(firstId);
  });

  it("checks acceptance of the intended recipient, including address objects", async () => {
    smtp.sendMail.mockResolvedValueOnce({ accepted: [], rejected: [input.to] });
    expect(await sendInternalLeaderEmail(input)).toEqual({ kind: "permanent_error", code: "SMTP_RECIPIENT_NOT_ACCEPTED" });
    smtp.sendMail.mockResolvedValueOnce({ accepted: [{ address: input.to.toUpperCase() }], rejected: [] });
    expect((await sendInternalLeaderEmail(input)).kind).toBe("accepted");
  });

  it.each(["bad email", "leader@example.test,other@example.test", "leader@example.test\r\nBcc: other@example.test"])(
    "rejects invalid or multiple recipients before transport: %s", async (to) => {
      expect(await sendInternalLeaderEmail({ ...input, to })).toEqual({ kind: "permanent_error", code: "INVALID_RECIPIENT_EMAIL" });
      expect(smtp.createTransport).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ responseCode: 451, message: "private smtp response" }, "retryable_error", "SMTP_TEMPORARY_REJECTION"],
    [{ responseCode: 550, message: "private address" }, "permanent_error", "SMTP_PERMANENT_REJECTION"],
    [{ code: "ETIMEDOUT", message: "private host" }, "retryable_error", "SMTP_CONNECTION_FAILED"],
    [{ code: "EAUTH", responseCode: 535, message: "private-password" }, "configuration_error", "SMTP_AUTHENTICATION_FAILED"],
    [{ code: "EAUTH", responseCode: 454, message: "private temporary auth failure" }, "retryable_error", "SMTP_TEMPORARY_REJECTION"],
    [{ code: "ERR_TLS_CERT_ALTNAME_INVALID" }, "configuration_error", "SMTP_TLS_CONFIGURATION_INVALID"],
    [new Error("private unknown error"), "retryable_error", "SMTP_SEND_FAILED"],
  ])("returns only a safe failure category for %j", async (cause, kind, code) => {
    smtp.sendMail.mockRejectedValueOnce(cause);
    expect(await sendInternalLeaderEmail(input)).toEqual({ kind, code });
    expect(smtp.close).toHaveBeenCalledOnce();
  });

  it("uses implicit TLS on port 465", async () => {
    vi.stubEnv("EMAIL_PORT", "465");
    await sendInternalLeaderEmail(input);
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true }));
  });
});

describe("internal email configuration validation", () => {
  it("does not create a transport or send mail while validating", () => {
    expect(validateInternalEmailConfiguration).not.toThrow();
    expect(smtp.createTransport).not.toHaveBeenCalled();
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it.each([
    ["EMAIL_HOST", ""], ["EMAIL_USER", ""], ["EMAIL_PASS", ""],
    ["EMAIL_PORT", "587suffix"], ["EMAIL_PORT", "65536"], ["EMAIL_PORT", "0"],
    ["EMAIL_FROM", "noreply@example.test\nBcc: other@example.test"],
    ["EMAIL_FROM", "not-an-email"], ["EMAIL_FROM", "one@example.test,two@example.test"],
    ["NEXTAUTH_URL", ""], ["NEXTAUTH_URL", "/relative"],
    ["NEXTAUTH_URL", "javascript:alert(1)"], ["NEXTAUTH_URL", "https://secret:pass@example.test"],
  ])("rejects invalid %s without exposing values", async (name, value) => {
    vi.stubEnv(name, value);
    expect(validateInternalEmailConfiguration).toThrow("EMAIL_CONFIGURATION_INVALID");
    expect(await sendInternalLeaderEmail(input)).toEqual({ kind: "configuration_error", code: "EMAIL_CONFIGURATION_INVALID" });
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });

  it("requires HTTPS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "http://sraw.example.test");
    expect(validateInternalEmailConfiguration).toThrow("EMAIL_CONFIGURATION_INVALID");
  });

  it("keeps the existing default sender when EMAIL_FROM is absent", async () => {
    vi.stubEnv("EMAIL_FROM", undefined);
    await sendInternalLeaderEmail(input);
    expect(smtp.sendMail.mock.calls[0][0].from).toBe("ระบบ SRAW <noreply@pea.co.th>");
  });

  it("uses optional defaults when deployment injects blank sender and port variables", async () => {
    vi.stubEnv("EMAIL_FROM", "  ");
    vi.stubEnv("EMAIL_PORT", "");
    await sendInternalLeaderEmail(input);
    expect(smtp.sendMail.mock.calls[0][0].from).toBe("ระบบ SRAW <noreply@pea.co.th>");
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587 }));
  });
});
