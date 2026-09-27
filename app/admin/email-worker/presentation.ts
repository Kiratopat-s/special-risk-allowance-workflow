import type { EmailDeliveryStatus } from "@/lib/domains/email-delivery/types";
import { dateTimeDisplay, monthDisplay } from "@/lib/shared/format";

export const deliveryLabels: Record<EmailDeliveryStatus, string> = {
  PENDING: "รอส่ง", PROCESSING: "กำลังประมวลผล", RETRY_WAIT: "รอลองใหม่",
  ACCEPTED: "SMTP รับแล้ว", FAILED: "ล้มเหลว", SKIPPED: "ข้ามการส่ง",
};

export const workerLabels: Record<string, string> = {
  STARTING: "กำลังเริ่มทำงาน", IDLE: "พร้อมรับงาน", PROCESSING: "กำลังประมวลผล",
  DEGRADED: "พบข้อผิดพลาด", STALLED: "ประมวลผลค้าง", STOPPING: "กำลังหยุด",
  STOPPED: "หยุดแล้ว", NO_SIGNAL: "ไม่พบสัญญาณ",
};

export const attemptLabels: Record<string, string> = {
  ...deliveryLabels, INTERRUPTED: "ถูกขัดจังหวะ", MANUAL_RETRY: "ผู้ดูแลจัดคิวใหม่", UNKNOWN: "ไม่ทราบผล",
};

export function displayTime(value: Date | string | null | undefined) {
  return value ? dateTimeDisplay(value) : "—";
}

export function displayMonth(value: Date | string | null | undefined) {
  return value ? monthDisplay(value) : "ไม่พบเดือนที่เบิก";
}

export function readyAge(oldest: Date | null, measuredAt: Date) {
  if (!oldest) return "—";
  const minutes = Math.max(0, Math.floor((new Date(measuredAt).getTime() - new Date(oldest).getTime()) / 60_000));
  if (minutes < 1) return "น้อยกว่า 1 นาที";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  return [days ? `${days} วัน` : "", hours ? `${hours} ชั่วโมง` : "", minutes % 60 ? `${minutes % 60} นาที` : ""].filter(Boolean).join(" ");
}

export function safeCode(value: string | null | undefined) {
  return value && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : null;
}

export function errorDescription(value: string | null | undefined) {
  const code = safeCode(value);
  if (!code) return value ? "ไม่สามารถแสดงรายละเอียดข้อผิดพลาดนี้ได้" : "—";
  const descriptions: Record<string, string> = {
    EMAIL_CONFIGURATION_INVALID: "ตรวจสอบการตั้งค่า SMTP และ URL ของระบบ",
    SMTP_AUTHENTICATION_FAILED: "ตรวจสอบบัญชีและรหัสผ่าน SMTP",
    SMTP_TLS_CONFIGURATION_INVALID: "ตรวจสอบใบรับรอง TLS ของ SMTP",
    INVALID_RECIPIENT: "ตรวจสอบอีเมลหลักของหัวหน้า",
    INVALID_RECIPIENT_EMAIL: "ตรวจสอบอีเมลหลักของหัวหน้า",
    RECIPIENT_INACTIVE: "ตรวจสอบสถานะบัญชีหัวหน้า",
    SMTP_PERMANENT_REJECTION: "SMTP ปฏิเสธอีเมล กรุณาตรวจสอบผู้รับและการตั้งค่า",
    SMTP_RECIPIENT_NOT_ACCEPTED: "SMTP ไม่รับผู้รับรายนี้",
    SMTP_TEMPORARY_REJECTION: "SMTP ขัดข้องชั่วคราว",
    SMTP_CONNECTION_FAILED: "เชื่อมต่อ SMTP ไม่สำเร็จหรือหมดเวลา",
    SMTP_SEND_FAILED: "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบสาเหตุก่อนลองใหม่",
    INVALID_EMAIL_CONTENT: "ข้อมูลสำหรับสร้างอีเมลไม่ครบถ้วน",
    CLAIM_NO_LONGER_PENDING: "เอกสารไม่ได้อยู่ในขั้นตอนรอหัวหน้ายืนยันแล้ว",
    NO_PENDING_VERIFICATIONS: "ไม่มีคำขอที่ยังรอยืนยันและไม่หมดอายุในรอบนี้",
    WORKER_INTERRUPTED: "การประมวลผลถูกขัดจังหวะก่อนบันทึกผล",
    RETRY_EXHAUSTED: "ประมวลผลครบจำนวนครั้งในรอบนี้แล้ว",
    TRANSPORT_UNEXPECTED: "ระบบส่งอีเมลขัดข้อง",
    DATABASE_CONNECTION_FAILED: "worker เชื่อมต่อฐานข้อมูลไม่สำเร็จ",
    DELIVERY_PROCESSING_FAILED: "worker ประมวลผลงานไม่สำเร็จ",
  };
  return descriptions[code] ? `${descriptions[code]} (${code})` : code;
}
