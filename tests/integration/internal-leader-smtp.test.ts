import { afterEach, describe, expect, it, vi } from "vitest";
import { sendInternalLeaderEmail, type InternalLeaderEmailInput } from "@/lib/email/internal-leader";
import { createSmtpFixture } from "@/tests/fixtures/smtp-server";

const input: InternalLeaderEmailInput = {
  to: "leader@example.test", deliveryId: "local-fixture-delivery", claimantName: "หัวหน้า ทดสอบ <script>",
  expenseMonth: new Date("2026-09-01"),
  orders: [{ reference: 'REF-1 <img src="x">', expiresAt: new Date("2026-09-30T18:00:00Z") }],
};
let fixture: Awaited<ReturnType<typeof createSmtpFixture>> | undefined;

async function smtp(options: Parameters<typeof createSmtpFixture>[0] = {}) {
  fixture = await createSmtpFixture(options);
  vi.stubEnv("EMAIL_HOST", "127.0.0.1");
  vi.stubEnv("EMAIL_PORT", String(fixture.port));
  vi.stubEnv("EMAIL_USER", "fixture-only");
  vi.stubEnv("EMAIL_PASS", "fixture-only");
  vi.stubEnv("EMAIL_FROM", "SRAW <noreply@example.test>");
  vi.stubEnv("NEXTAUTH_URL", "https://sraw.example.test");
  return fixture;
}

function decodedBody(message: string): string {
  const boundary = message.match(/boundary="([^"]+)"/)?.[1];
  if (!boundary) throw new Error("Expected multipart fixture email");
  return message.split(`--${boundary}`).slice(1, -1).map((part) => {
    const divider = part.indexOf("\r\n\r\n");
    const headers = part.slice(0, divider);
    const body = part.slice(divider + 4).trim();
    if (headers.includes("Content-Transfer-Encoding: base64")) return Buffer.from(body, "base64").toString("utf8");
    const bytes = body.replace(/=\r\n/g, "").replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return Buffer.from(bytes, "latin1").toString("utf8");
  }).join("\n");
}

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
  vi.unstubAllEnvs();
});

describe("internal leader email over local SMTP", () => {
  it("sends real MIME mail with Thai text, escaped HTML and the authenticated link", async () => {
    const server = await smtp();
    const result = await sendInternalLeaderEmail(input);
    expect(result.kind).toBe("accepted");
    expect(server.accepted).toHaveLength(1);
    const body = decodedBody(server.accepted[0]);
    expect(body).toContain(input.claimantName);
    expect(body).toContain("หัวหน้า ทดสอบ &lt;script&gt;");
    expect(body).toContain("REF-1 &lt;img src=&quot;x&quot;&gt;");
    expect(body).toContain("https://sraw.example.test/dashboard?tab=leader-queue");
    expect(body).not.toContain("token=");
    expect(server.accepted[0]).toContain("Content-Type: multipart/alternative;");
    expect(server.accepted[0]).toContain("To: leader@example.test");
    if (result.kind === "accepted") expect(server.accepted[0].replace(/\r\n[ \t]+/g, " ")).toContain(`Message-ID: ${result.messageId}`);
  });

  it.each([
    ["451 4.3.0 Try later", "retryable_error", "SMTP_TEMPORARY_REJECTION"],
    ["550 5.1.1 Unknown recipient", "permanent_error", "SMTP_PERMANENT_REJECTION"],
  ])("classifies a real RCPT rejection: %s", async (recipientResponse, kind, code) => {
    const server = await smtp({ recipientResponse });
    expect(await sendInternalLeaderEmail(input)).toEqual({ kind, code });
    expect(server.received).toHaveLength(0);
  });

  it("classifies SMTP authentication failure without exposing the server response", async () => {
    await smtp({ authResponse: "535 5.7.8 Fixture credentials rejected" });
    expect(await sendInternalLeaderEmail(input)).toEqual({ kind: "configuration_error", code: "SMTP_AUTHENTICATION_FAILED" });
  });

  it("retries an SMTP authentication service outage", async () => {
    await smtp({ authResponse: "454 4.7.0 Authentication service temporarily unavailable" });
    expect(await sendInternalLeaderEmail(input)).toEqual({ kind: "retryable_error", code: "SMTP_TEMPORARY_REJECTION" });
  });

  it("does not record acceptance before the SMTP server accepts DATA", async () => {
    let finish!: (reply: string) => void;
    let dataReceived!: () => void;
    const received = new Promise<void>((resolve) => { dataReceived = resolve; });
    const server = await smtp({ onData: () => {
      dataReceived();
      return new Promise((resolve) => { finish = resolve; });
    } });
    let completed = false;
    const sending = sendInternalLeaderEmail(input).then((result) => { completed = true; return result; });
    await received;
    expect(completed).toBe(false);
    expect(server.accepted).toHaveLength(0);
    finish("451 4.3.0 Temporary storage failure");
    expect(await sending).toEqual({ kind: "retryable_error", code: "SMTP_TEMPORARY_REJECTION" });
    expect(server.accepted).toHaveLength(0);
  });
});
