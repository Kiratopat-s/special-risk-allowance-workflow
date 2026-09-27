import { error, success, type Result } from "@/lib/shared/types";
import { EMAIL_DELIVERY_STATUSES } from "./types";
import type { EmailDashboardFilter } from "./dashboard-types";

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateDashboardFilter(value: unknown): Result<EmailDashboardFilter> {
  const invalid = () => error("ตัวกรองงานอีเมลไม่ถูกต้อง", "VALIDATION_ERROR");
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const filter = value as EmailDashboardFilter;
  if ((filter.page !== undefined && (!Number.isSafeInteger(filter.page) || filter.page < 1)) ||
    (filter.status !== undefined && !EMAIL_DELIVERY_STATUSES.includes(filter.status)) ||
    (filter.search !== undefined && (typeof filter.search !== "string" || filter.search.length > 200)) ||
    (filter.from !== undefined && !calendarDate(filter.from)) ||
    (filter.to !== undefined && !calendarDate(filter.to)) ||
    (filter.from && filter.to && filter.from > filter.to)) return invalid();
  return success({ page: filter.page ?? 1, status: filter.status, search: filter.search?.trim() || undefined,
    from: filter.from, to: filter.to });
}

export function bangkokDateBounds(filter: Pick<EmailDashboardFilter, "from" | "to">) {
  return {
    from: filter.from ? new Date(`${filter.from}T00:00:00+07:00`) : undefined,
    until: filter.to ? new Date(new Date(`${filter.to}T00:00:00+07:00`).getTime() + 86_400_000) : undefined,
  };
}

export function validDeliveryId(id: unknown): id is string {
  return typeof id === "string" && Boolean(id.trim()) && id.length <= 100;
}

// This allowlist is applied before serialization, not just before rendering.
const safeErrors = new Set([
  "EMAIL_CONFIGURATION_INVALID", "SMTP_AUTHENTICATION_FAILED", "SMTP_TLS_CONFIGURATION_INVALID",
  "INVALID_RECIPIENT", "INVALID_RECIPIENT_EMAIL", "RECIPIENT_INACTIVE", "SMTP_PERMANENT_REJECTION",
  "SMTP_RECIPIENT_NOT_ACCEPTED", "SMTP_TEMPORARY_REJECTION", "SMTP_CONNECTION_FAILED", "SMTP_SEND_FAILED",
  "INVALID_EMAIL_CONTENT", "CLAIM_NO_LONGER_PENDING", "NO_PENDING_VERIFICATIONS", "WORKER_INTERRUPTED",
  "RETRY_EXHAUSTED", "TRANSPORT_UNEXPECTED", "DELIVERY_PROCESSING_FAILED", "DATABASE_CONNECTION_FAILED",
  "HEALTH_SERVER_FAILED", "WORKER_RUNTIME_FAILED", "SHUTDOWN_DELIVERY_TIMEOUT", "SHUTDOWN_INCOMPLETE",
]);

export function safeEmailErrorCode(code: string | null): string | null {
  return code === null ? null : safeErrors.has(code) ? code : "UNKNOWN_ERROR";
}

export function safeEmailMessageId(value: string | null): string | null {
  return value && /^<[^\s<>\r\n]{1,998}>$/.test(value) ? value : null;
}
