/**
 * Email Service
 *
 * Sends transactional emails via SMTP (nodemailer).
 *
 * Required environment variables:
 *   EMAIL_HOST     — SMTP hostname (e.g. smtp.pea.co.th)
 *   EMAIL_PORT     — SMTP port (default: 587)
 *   EMAIL_USER     — SMTP username
 *   EMAIL_PASS     — SMTP password
 *   EMAIL_FROM     — Sender address (e.g. "ระบบ SRAW <noreply@pea.co.th>")
 *   NEXTAUTH_URL   — App base URL used to build token links (already required by next-auth)
 *
 * @module lib/email
 */

import nodemailer from "nodemailer";

function createTransport() {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT ?? "587", 10);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

const FROM = process.env.EMAIL_FROM ?? "ระบบ SRAW <noreply@pea.co.th>";

/**
 * Build the full public URL for a leader verification token link.
 */
export function buildLeaderVerifyUrl(token: string): string {
    const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    return `${base}/leader-verify?token=${encodeURIComponent(token)}`;
}

/**
 * Send a leader verification link to an external leader's email address.
 * Returns true on success, false if email is not configured or send fails.
 *
 * Fire-and-forget safe — caller should not await when inside user request paths.
 */
export async function sendLeaderVerifyEmail({
    to,
    token,
    offSiteWorkRef,
    claimantName,
    expiresAt,
}: {
    to: string;
    token: string;
    offSiteWorkRef?: string | null;
    claimantName?: string;
    expiresAt: Date;
}): Promise<boolean> {
    const transport = createTransport();
    if (!transport) {
        // Email not configured — skip silently (log for ops visibility)
        console.warn("[email] EMAIL_HOST / EMAIL_USER / EMAIL_PASS not configured — skipping leader verify email");
        return false;
    }

    const verifyUrl = buildLeaderVerifyUrl(token);
    const expiryText = expiresAt.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Bangkok",
    });

    const subject = "ขอให้ยืนยันการออกปฏิบัติงานนอกสถานที่";

    const refLine = offSiteWorkRef ? `เลขที่คำสั่ง: <strong>${offSiteWorkRef}</strong><br>` : "";
    const claimantLine = claimantName ? `ผู้ยื่นเบิก: <strong>${claimantName}</strong><br>` : "";

    const html = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#0369a1">แจ้งเตือน: มีคำขอยืนยันการออกปฏิบัติงานนอกสถานที่</h2>
  <p>เรียน ท่านหัวหน้า,</p>
  <p>พนักงานได้ยื่นเอกสารเบิกค่าตอบแทนเสี่ยงภัยฯ และต้องการการยืนยันจากท่าน</p>
  <p style="background:#f0f9ff;border-left:4px solid #0369a1;padding:12px 16px;border-radius:4px">
    ${refLine}${claimantLine}
    ลิงก์หมดอายุวันที่: <strong>${expiryText}</strong>
  </p>
  <p>กรุณาคลิกปุ่มด้านล่างเพื่อดูรายละเอียดและยืนยัน:</p>
  <p>
    <a href="${verifyUrl}"
       style="display:inline-block;padding:12px 24px;background:#0369a1;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
      ยืนยันการออกปฏิบัติงาน
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    หากไม่สามารถคลิกปุ่มได้ กรุณาคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>
    <a href="${verifyUrl}" style="color:#0369a1;word-break:break-all">${verifyUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#999;font-size:12px">
    อีเมลนี้ส่งโดยอัตโนมัติจากระบบ SRAW — กรุณาอย่าตอบกลับ
  </p>
</body>
</html>`;

    const text = `มีคำขอยืนยันการออกปฏิบัติงานนอกสถานที่\n${offSiteWorkRef ? "เลขที่คำสั่ง: " + offSiteWorkRef + "\n" : ""}${claimantName ? "ผู้ยื่นเบิก: " + claimantName + "\n" : ""}ลิงก์หมดอายุวันที่: ${expiryText}\n\nยืนยันได้ที่: ${verifyUrl}`;

    try {
        await transport.sendMail({ from: FROM, to, subject, html, text });
        return true;
    } catch (err) {
        console.error("[email] Failed to send leader verify email to", to, err);
        return false;
    }
}
