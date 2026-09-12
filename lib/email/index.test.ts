import { afterEach, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
import { sendLeaderVerifyEmail } from "./index";

afterEach(() => vi.unstubAllEnvs());
it("renders an expiry after Thai New Year in Buddhist years while retaining the document ID", async () => {
  vi.stubEnv("EMAIL_HOST", "smtp.example.test");
  vi.stubEnv("EMAIL_USER", "test");
  vi.stubEnv("EMAIL_PASS", "test");
  await sendLeaderVerifyEmail({
    to: "leader@example.test",
    token: "fixture-token",
    offSiteWorkRef: "TZ26010001",
    claimantName: "ทดสอบ",
    expiresAt: new Date("2026-12-31T18:00:00Z"),
  });
  expect(sendMail).toHaveBeenCalledTimes(1);
  const { html, text } = sendMail.mock.calls[0][0];
  expect(html).toContain("1 มกราคม 2570");
  expect(text).toContain("1 มกราคม 2570");
  expect(html).toContain("TZ26010001");
});
