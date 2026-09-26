"use server";

import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth/permissions";
import { emailDeliveryService } from "@/lib/domains/email-delivery";
import type { EmailDeliveryStatus, EmailDeliveryView } from "@/lib/domains/email-delivery/types";
import type { PaginatedResult, Result } from "@/lib/shared/types";

const statuses: EmailDeliveryStatus[] = [
  "PENDING", "PROCESSING", "RETRY_WAIT", "ACCEPTED", "FAILED", "SKIPPED",
];

async function requireEmailAdmin(): Promise<Result<string>> {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) {
    return { success: false, error: "กรุณาเข้าสู่ระบบ", code: "UNAUTHORIZED" };
  }
  if (!(await hasRole(userId, "super-admin"))) {
    return { success: false, error: "ไม่มีสิทธิ์จัดการประวัติอีเมล", code: "PERMISSION_DENIED" };
  }
  return { success: true, data: userId };
}

export async function listEmailDeliveries(filters: {
  page?: number;
  status?: EmailDeliveryStatus;
  search?: string;
} = {}): Promise<Result<PaginatedResult<EmailDeliveryView>>> {
  const authorization = await requireEmailAdmin();
  if (!authorization.success) return authorization;

  if (
    !filters || typeof filters !== "object" ||
    (filters.page !== undefined && (!Number.isSafeInteger(filters.page) || filters.page < 1)) ||
    (filters.status !== undefined && !statuses.includes(filters.status)) ||
    (filters.search !== undefined && (typeof filters.search !== "string" || filters.search.length > 200))
  ) {
    return { success: false, error: "ตัวกรองประวัติอีเมลไม่ถูกต้อง", code: "VALIDATION_ERROR" };
  }

  return emailDeliveryService.list({
    page: filters.page ?? 1,
    status: filters.status,
    search: filters.search?.trim() || undefined,
  });
}

export async function retryEmailDelivery(id: string): Promise<Result<void>> {
  const authorization = await requireEmailAdmin();
  if (!authorization.success) return authorization;
  if (typeof id !== "string" || !id.trim() || id.length > 100) {
    return { success: false, error: "ไม่พบรายการอีเมลที่ต้องการลองใหม่", code: "VALIDATION_ERROR" };
  }

  // The service checks current eligibility and changes FAILED to PENDING atomically.
  // Actor identity comes only from the session, never from client input.
  return emailDeliveryService.retry(id.trim(), authorization.data);
}
