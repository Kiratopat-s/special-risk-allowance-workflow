import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import addressparser from "nodemailer/lib/addressparser";
import { z } from "zod";
import { dateTimeDisplay, monthDisplay } from "@/lib/shared/format";

export interface InternalLeaderEmailInput {
  to: string;
  deliveryId: string;
  claimantName: string;
  expenseMonth: Date;
  orders: { reference: string | null; expiresAt: Date }[];
}

export type EmailSendResult =
  | { kind: "accepted"; messageId: string }
  | { kind: "retryable_error" | "permanent_error" | "configuration_error"; code: string };

const mailbox = z.email();
const defaultFrom = "ระบบ SRAW <noreply@pea.co.th>";

function readConfiguration() {
  const host = process.env.EMAIL_HOST?.trim();
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const rawPort = process.env.EMAIL_PORT?.trim() || "587";
  const port = Number(rawPort);
  const from = process.env.EMAIL_FROM?.trim() || defaultFrom;
  const rawUrl = process.env.NEXTAUTH_URL;
  if (!host || /[\s\r\n]/.test(host) || !user || !pass ||
    !/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535 ||
    /[\r\n]/.test(from) || !rawUrl) {
    throw new Error("EMAIL_CONFIGURATION_INVALID");
  }
  const senders = addressparser(from, { flatten: true });
  if (senders.length !== 1 || !mailbox.safeParse(senders[0].address).success) {
    throw new Error("EMAIL_CONFIGURATION_INVALID");
  }
  let appUrl: URL;
  try {
    appUrl = new URL(rawUrl);
  } catch {
    throw new Error("EMAIL_CONFIGURATION_INVALID");
  }
  if (!["http:", "https:"].includes(appUrl.protocol) || !appUrl.hostname ||
    appUrl.username || appUrl.password || appUrl.search || appUrl.hash ||
    (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:")) {
    throw new Error("EMAIL_CONFIGURATION_INVALID");
  }
  return { host, user, pass, port, from, appUrl };
}

/** Validates local configuration only; does not connect to SMTP or send mail. */
export function validateInternalEmailConfiguration(): void {
  readConfiguration();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function classifyFailure(cause: unknown): EmailSendResult {
  const details = cause && typeof cause === "object"
    ? cause as { code?: unknown; responseCode?: unknown } : {};
  const responseCode = Number(details.responseCode);
  if (responseCode >= 400 && responseCode < 500) {
    return { kind: "retryable_error", code: "SMTP_TEMPORARY_REJECTION" };
  }
  if (details.code === "EAUTH" || [530, 534, 535, 538].includes(Number(details.responseCode))) {
    return { kind: "configuration_error", code: "SMTP_AUTHENTICATION_FAILED" };
  }
  if (["ETLS", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(String(details.code))) {
    return { kind: "configuration_error", code: "SMTP_TLS_CONFIGURATION_INVALID" };
  }
  if (responseCode >= 500 && responseCode < 600) {
    return { kind: "permanent_error", code: "SMTP_PERMANENT_REJECTION" };
  }
  if (["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "EDNS", "ENOTFOUND"].includes(String(details.code))) {
    return { kind: "retryable_error", code: "SMTP_CONNECTION_FAILED" };
  }
  return { kind: "retryable_error", code: "SMTP_SEND_FAILED" };
}

/** SMTP acceptance is recorded separately from inbox delivery or reading. */
export async function sendInternalLeaderEmail(input: InternalLeaderEmailInput): Promise<EmailSendResult> {
  const to = input.to.trim();
  if (!mailbox.safeParse(to).success) {
    return { kind: "permanent_error", code: "INVALID_RECIPIENT_EMAIL" };
  }
  if (!input.deliveryId || !input.orders.length ||
    !Number.isFinite(input.expenseMonth.getTime()) ||
    input.orders.some((order) => !Number.isFinite(order.expiresAt.getTime()))) {
    return { kind: "permanent_error", code: "INVALID_EMAIL_CONTENT" };
  }
  let config: ReturnType<typeof readConfiguration>;
  try {
    config = readConfiguration();
  } catch {
    return { kind: "configuration_error", code: "EMAIL_CONFIGURATION_INVALID" };
  }

  const queueUrl = new URL("/dashboard?tab=leader-queue", config.appUrl).href;
  const messageId = `<sraw-leader-${createHash("sha256").update(input.deliveryId).digest("hex")}@${config.appUrl.hostname}>`;
  const expenseMonth = monthDisplay(input.expenseMonth);
  const orders = input.orders.map((order, index) => ({
    reference: order.reference || `คำสั่งปฏิบัติงานรายการที่ ${index + 1}`,
    expiresAt: dateTimeDisplay(order.expiresAt),
  }));
  const text = [
    "แจ้งเตือน: มีเอกสารขอเบิกรอการรับรองจากท่าน",
    `ผู้ยื่นเบิก: ${input.claimantName}`,
    `เดือนที่ขอเบิก: ${expenseMonth}`,
    "รายการคำสั่งปฏิบัติงานที่รอการรับรอง:",
    ...orders.map((order) => `- ${order.reference} (รับรองได้ถึง ${order.expiresAt} น. เวลาไทย)`),
    "", "กรุณาเข้าสู่ระบบด้วยบัญชีหัวหน้างานของท่านเพื่อดูรายละเอียดและรับรอง:",
    queueUrl,
    "", "หากรับรองหรือมีการแก้ไขเอกสารแล้ว ระบบจะแสดงสถานะล่าสุดเมื่อเปิดรายการ",
    "อีเมลนี้ส่งโดยอัตโนมัติจากระบบ SRAW กรุณาอย่าตอบกลับ",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h2>มีเอกสารขอเบิกรอการรับรองจากท่าน</h2>
  <p>เรียน ท่านหัวหน้างาน</p>
  <p>ผู้ยื่นเบิก: <strong>${escapeHtml(input.claimantName)}</strong><br>เดือนที่ขอเบิก: <strong>${escapeHtml(expenseMonth)}</strong></p>
  <p>รายการคำสั่งปฏิบัติงานที่รอการรับรอง:</p>
  <ul>${orders.map((order) => `<li>${escapeHtml(order.reference)}<br>รับรองได้ถึง ${escapeHtml(order.expiresAt)} น. เวลาไทย</li>`).join("")}</ul>
  <p>กรุณาเข้าสู่ระบบด้วยบัญชีหัวหน้างานของท่านเพื่อดูรายละเอียดและรับรอง</p>
  <p><a href="${escapeHtml(queueUrl)}" style="display:inline-block;padding:12px 24px;background:#0369a1;color:#fff;text-decoration:none;border-radius:6px">เปิดรายการรอรับรอง</a></p>
  <p>หากไม่สามารถคลิกปุ่มได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br><a href="${escapeHtml(queueUrl)}">${escapeHtml(queueUrl)}</a></p>
  <p>หากรับรองหรือมีการแก้ไขเอกสารแล้ว ระบบจะแสดงสถานะล่าสุดเมื่อเปิดรายการ</p>
  <hr><p style="color:#666;font-size:12px">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ SRAW กรุณาอย่าตอบกลับ</p>
</body></html>`;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    dnsTimeout: 10_000,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  try {
    const info = await transport.sendMail({
      from: config.from,
      to,
      subject: "มีเอกสารขอเบิกค่าตอบแทนเสี่ยงภัยฯ รอการรับรอง",
      messageId,
      html,
      text,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const accepted = Array.isArray(info.accepted) && info.accepted.some((recipient) =>
      (typeof recipient === "string" ? recipient : recipient.address).toLowerCase() === to.toLowerCase());
    return accepted
      ? { kind: "accepted", messageId }
      : { kind: "permanent_error", code: "SMTP_RECIPIENT_NOT_ACCEPTED" };
  } catch (cause) {
    return classifyFailure(cause);
  } finally {
    transport.close();
  }
}
